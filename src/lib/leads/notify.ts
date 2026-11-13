/**
 * Notificación de leads por Resend (único proveedor).
 *
 * Contenido mínimo: lo necesario para contactar al lead. Sin UTM, IDs de clic
 * ni URL de página (se quedan en la base de datos).
 * `Idempotency-Key: lead/{submission_id}` evita envíos duplicados durante 24 h
 * (reintentos o ejecuciones concurrentes).
 */
import type { LeadNotification, NotifyResult } from './types';

export interface ResendConfig {
  apiKey: string;
  from: string;
  /** Lista separada por comas. */
  to: string;
}

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000;

export function parseRecipients(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fechaMadrid(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(iso));
}

/** Filas etiqueta/valor del email, en orden. */
export function notificationLines(n: LeadNotification): [string, string][] {
  const lines: [string, string][] = [
    ['Nombre', n.nombre],
    ['Teléfono', n.telefono],
  ];
  if (n.email) lines.push(['Email', n.email]);
  lines.push(['Ciudad', n.ciudad]);
  if (n.interes) lines.push(['Interés', n.interes]);
  lines.push(['Landing', n.landing], ['Fecha', fechaMadrid(n.createdAt)], ['Referencia', n.submissionId]);
  return lines;
}

export function buildEmail(n: LeadNotification) {
  const lines = notificationLines(n);
  const subject = `Nueva solicitud de valoración · ${n.ciudad}`;
  const text = `${lines.map(([k, v]) => `${k}: ${v}`).join('\n')}\n`;
  const rows = lines
    .map(
      ([k, v]) =>
        `<tr><th align="left" style="padding:4px 12px 4px 0">${escapeHtml(k)}</th><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
    )
    .join('');
  const html = `<p>Nueva solicitud desde las landings de anuncios.</p><table>${rows}</table>`;
  return { subject, text, html };
}

export async function notifyLead(
  n: LeadNotification,
  config: ResendConfig | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  if (!config) return { ok: false, error: 'Resend no configurado' };
  const to = parseRecipients(config.to);
  if (to.length === 0) return { ok: false, error: 'LEADS_EMAIL_TO vacío' };

  const { subject, text, html } = buildEmail(n);
  try {
    const res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `lead/${n.submissionId}`,
      },
      body: JSON.stringify({
        from: config.from,
        to,
        subject,
        text,
        html,
        ...(n.email ? { reply_to: n.email } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    // El error de Resend describe el problema (clave, dominio, límite), no el contenido.
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, error: `Resend sin respuesta: ${err instanceof Error ? err.name : 'error'}` };
  }
}
