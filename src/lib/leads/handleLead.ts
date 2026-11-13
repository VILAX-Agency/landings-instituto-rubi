/**
 * Lógica del endpoint POST /api/lead/ (Fase 2), sin dependencias de Astro.
 *
 * Orden: tamaño/JSON → honeypot → Turnstile → validación → landing de confianza
 * → INSERT (idempotente por submission_id) → notificación → estado del envío.
 * Nunca responde éxito si el lead no se ha guardado. Los logs solo llevan el
 * submission_id, nunca datos personales.
 */
import { ciudadesFormulario } from '../../components/forms/formConfig';
import { erroresPorCampo, leadInputSchema, type CampoVisible } from './schema';
import type { LeadNotification, LeadRow, LeadStore, NotifyResult, TrustedLanding } from './types';

export const MAX_BODY_BYTES = 8 * 1024;

export interface LeadDeps {
  store: LeadStore;
  notify(n: LeadNotification): Promise<NotifyResult>;
  verifyTurnstile(token: string | undefined): Promise<boolean>;
  findLanding(landingId: string): Promise<TrustedLanding | undefined>;
  now?: () => Date;
  log?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export type LeadResponseBody =
  | { ok: true }
  | {
      ok: false;
      error: 'payload' | 'verification' | 'validation' | 'unavailable';
      fields?: Partial<Record<CampoVisible, string>>;
    };

export interface LeadResult {
  status: number;
  body: LeadResponseBody;
}

const OK: LeadResult = { status: 200, body: { ok: true } };

/** Lee el cuerpo JSON con límite de tamaño. */
export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown | LeadResult> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    return { status: 415, body: { ok: false, error: 'payload' } };
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return { status: 413, body: { ok: false, error: 'payload' } };

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { status: 413, body: { ok: false, error: 'payload' } };
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { status: 400, body: { ok: false, error: 'payload' } };
  }
}

export function isLeadResult(value: unknown): value is LeadResult {
  return typeof value === 'object' && value !== null && 'status' in value && 'body' in value;
}

/** Versión corta y estable del texto de privacidad mostrado (SHA-256, 12 hex). */
export async function privacyNoticeVersion(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto.trim()));
  return Array.from(new Uint8Array(digest).slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('');
}

const CIUDAD_LABEL = new Map(ciudadesFormulario.map((c) => [c.valor, c.label]));

/** Notificación mínima a partir de una fila (también para los reintentos). */
export function buildNotification(row: LeadRow, landing?: TrustedLanding): LeadNotification {
  const landingNombre = landing
    ? [landing.tratamientoNombre, landing.localidadNombre].filter(Boolean).join(' · ')
    : row.landing_id;
  return {
    submissionId: row.submission_id,
    createdAt: row.created_at ?? row.privacy_acknowledged_at,
    nombre: row.nombre,
    telefono: row.telefono,
    email: row.email ?? undefined,
    ciudad: CIUDAD_LABEL.get(row.ciudad) ?? row.ciudad,
    interes: row.interes ? (landing?.interesOpciones[row.interes] ?? row.interes) : undefined,
    landing: `${landingNombre} (${row.landing_id})`,
  };
}

export async function handleLead(raw: unknown, deps: LeadDeps): Promise<LeadResult> {
  const log = deps.log ?? console;
  const now = (deps.now ?? (() => new Date()))();

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { status: 400, body: { ok: false, error: 'payload' } };
  }

  // 1. Honeypot: éxito aparente, no se guarda nada.
  const website = (raw as Record<string, unknown>).website;
  if (typeof website === 'string' && website.trim() !== '') {
    log.info('[lead] honeypot: envío descartado');
    return OK;
  }

  // 2. Turnstile (falla cerrado).
  const token = (raw as Record<string, unknown>).turnstile_token;
  if (!(await deps.verifyTurnstile(typeof token === 'string' ? token : undefined))) {
    return { status: 403, body: { ok: false, error: 'verification' } };
  }

  // 3. Validación de forma.
  const parsed = leadInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = erroresPorCampo(parsed.error);
    return { status: 400, body: { ok: false, error: Object.keys(fields).length ? 'validation' : 'payload', fields } };
  }
  const input = parsed.data;

  // 4. Landing e interés desde el contenido del repositorio.
  const landing = await deps.findLanding(input.landing_id);
  if (!landing) {
    log.warn(`[lead] landing desconocida o no publicable (${input.submission_id})`);
    return { status: 400, body: { ok: false, error: 'payload' } };
  }
  if (input.interes && !(input.interes in landing.interesOpciones)) {
    return { status: 400, body: { ok: false, error: 'validation', fields: { interes: 'Elige una opción.' } } };
  }

  const row: LeadRow = {
    submission_id: input.submission_id,
    landing_id: landing.landingId,
    tratamiento: landing.tratamiento,
    localidad: landing.localidad ?? null,
    nombre: input.nombre,
    telefono: input.telefono,
    email: input.email ?? null,
    ciudad: input.ciudad,
    interes: input.interes ?? null,
    privacy_notice_version: await privacyNoticeVersion(landing.textoPrivacidad),
    privacy_acknowledged_at: now.toISOString(),
    page_url: input.page_url ?? null,
    utm_source: input.utm_source ?? null,
    utm_medium: input.utm_medium ?? null,
    utm_campaign: input.utm_campaign ?? null,
    utm_term: input.utm_term ?? null,
    utm_content: input.utm_content ?? null,
    gclid: input.gclid ?? null,
    fbclid: input.fbclid ?? null,
    // Quien inserta es dueño del primer envío (el cron no lo toca en 15 min).
    notification_status: 'pending',
    notification_attempts: 1,
    notification_claimed_at: now.toISOString(),
  };

  // 5. Persistencia. Sin guardar no hay éxito.
  let inserted: 'created' | 'duplicate';
  try {
    inserted = await deps.store.insertLead(row);
  } catch (err) {
    log.error(`[lead] error al guardar (${row.submission_id}): ${err instanceof Error ? err.message : 'error'}`);
    return { status: 503, body: { ok: false, error: 'unavailable' } };
  }
  if (inserted === 'duplicate') {
    log.info(`[lead] envío repetido, ya guardado (${row.submission_id})`);
    return OK;
  }

  // 6. Notificación: un fallo no invalida el lead guardado.
  let result: NotifyResult;
  try {
    result = await deps.notify(buildNotification({ ...row, created_at: row.privacy_acknowledged_at }, landing));
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : 'error' };
  }
  if (!result.ok) log.warn(`[lead] notificación fallida (${row.submission_id}): ${result.error}`);

  try {
    await deps.store.finishNotification(row.submission_id, result);
  } catch (err) {
    // El lead está guardado; el cron lo recuperará cuando caduque la reclamación.
    log.error(`[lead] no se pudo registrar el estado (${row.submission_id}): ${err instanceof Error ? err.message : 'error'}`);
  }

  log.info(`[lead] guardado (${row.submission_id}), notificación ${result.ok ? 'enviada' : 'pendiente de reintento'}`);
  return OK;
}
