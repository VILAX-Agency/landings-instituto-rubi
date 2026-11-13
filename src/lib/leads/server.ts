/**
 * Construye las dependencias reales del flujo de leads a partir de las
 * variables de servidor (astro:env). Solo lo importan las rutas de src/pages/api/.
 */
import {
  CRON_SECRET,
  LEADS_EMAIL_FROM,
  LEADS_EMAIL_TO,
  RESEND_API_KEY,
  SUPABASE_SECRET_KEY,
  SUPABASE_URL,
  TURNSTILE_SECRET_KEY,
} from 'astro:env/server';
import { createSupabaseStore } from './db';
import { findTrustedLanding } from './landings';
import { notifyLead, type ResendConfig } from './notify';
import { verifyTurnstile } from './turnstile';
import type { LeadDeps } from './handleLead';
import type { RetryDeps } from './retry';

export const leadsEnabled = import.meta.env.PUBLIC_LEADS_ENABLED === 'true';

const resendConfig: ResendConfig | undefined =
  RESEND_API_KEY && LEADS_EMAIL_FROM && LEADS_EMAIL_TO
    ? { apiKey: RESEND_API_KEY, from: LEADS_EMAIL_FROM, to: LEADS_EMAIL_TO }
    : undefined;

/** Turnstile falla cerrado fuera de `astro dev`: sin clave secreta no se acepta ningún envío. */
async function checkTurnstile(token: string | undefined): Promise<boolean> {
  if (TURNSTILE_SECRET_KEY) return verifyTurnstile(token, TURNSTILE_SECRET_KEY);
  if (import.meta.env.DEV) {
    console.warn('[lead] TURNSTILE_SECRET_KEY no configurada: verificación omitida (solo astro dev).');
    return true;
  }
  console.error('[lead] TURNSTILE_SECRET_KEY no configurada: envío rechazado.');
  return false;
}

function baseDeps() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return undefined;
  if (!resendConfig) console.warn('[lead] Resend no configurado: los leads se guardan como "failed".');
  return {
    store: createSupabaseStore(SUPABASE_URL, SUPABASE_SECRET_KEY),
    notify: (n: Parameters<typeof notifyLead>[0]) => notifyLead(n, resendConfig),
    findLanding: findTrustedLanding,
  };
}

/** undefined = falta configuración de Supabase (el endpoint responde 503). */
export function getLeadDeps(): LeadDeps | undefined {
  const base = baseDeps();
  return base && { ...base, verifyTurnstile: checkTurnstile };
}

export function getRetryDeps(): RetryDeps | undefined {
  return baseDeps();
}

/** Comparación en tiempo constante del token del cron. */
export function isAuthorizedCron(authorization: string | null): boolean {
  if (!CRON_SECRET || !authorization) return false;
  const expected = new TextEncoder().encode(`Bearer ${CRON_SECRET}`);
  const given = new TextEncoder().encode(authorization);
  if (expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ given[i];
  return diff === 0;
}
