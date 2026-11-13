/** Verificación de Cloudflare Turnstile en servidor. Sin IP del usuario. */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8000;

export async function verifyTurnstile(
  token: string | undefined,
  secret: string,
  fetchImpl: typeof fetch = fetch,
  log: Pick<Console, 'warn'> = console,
): Promise<boolean> {
  if (!token) {
    log.warn('[lead] Turnstile: envío sin token (el widget no lo generó en el navegador)');
    return false;
  }
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn(`[lead] Turnstile: siteverify respondió ${res.status}`);
      return false;
    }
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[]; hostname?: string };
    if (data.success !== true) {
      // Códigos de Cloudflare (p. ej. invalid-input-secret, invalid-input-response). Sin datos personales.
      log.warn(`[lead] Turnstile rechazado: ${(data['error-codes'] ?? []).join(',') || 'sin código'}`);
      return false;
    }
    return true;
  } catch (err) {
    // Falla cerrado: si Turnstile no responde, no se acepta el envío.
    log.warn(`[lead] Turnstile sin respuesta: ${err instanceof Error ? err.name : 'error'}`);
    return false;
  }
}
