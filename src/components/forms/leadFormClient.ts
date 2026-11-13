/**
 * Envío del formulario de leads en el navegador (Fase 2).
 *
 * - submission_id generado en el navegador al cargar; se conserva en los
 *   reintentos tras un error de red (el servidor no duplica el lead).
 * - Turnstile se carga de forma diferida al primer foco en el formulario.
 * - Solo se navega a la página de gracias tras `{ ok: true }` del servidor.
 */

type Campo = 'nombre' | 'telefono' | 'email' | 'ciudad' | 'interes' | 'consentimiento';

interface LeadResponse {
  ok: boolean;
  error?: 'payload' | 'verification' | 'validation' | 'unavailable';
  fields?: Partial<Record<Campo, string>>;
}

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_TIMEOUT_MS = 15000;
const ATRIBUCION: [string, number][] = [
  ['utm_source', 200],
  ['utm_medium', 200],
  ['utm_campaign', 200],
  ['utm_term', 200],
  ['utm_content', 200],
  ['gclid', 300],
  ['fbclid', 300],
];

let turnstileScript: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  turnstileScript ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    script.onerror = () => {
      turnstileScript = undefined;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return turnstileScript;
}

function newSubmissionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function initLeadForm(form: HTMLFormElement): void {
  const endpoint = form.dataset.endpoint;
  const thanks = form.dataset.thanks ?? '/gracias/';
  const siteKey = form.dataset.turnstileSitekey;
  const telefono = form.dataset.telefono;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const status = form.querySelector<HTMLElement>('[data-status]');
  const turnstileBox = form.querySelector<HTMLElement>('[data-turnstile]');
  if (!endpoint || !button || !status) return;

  const ctaLabel = button.textContent?.trim() ?? '';
  let submissionId = newSubmissionId();
  let sending = false;

  // --- Turnstile (diferido) ---
  let widgetId: string | undefined;
  let token: string | undefined;
  let tokenWaiters: ((t: string | undefined) => void)[] = [];
  const settleToken = (t: string | undefined) => {
    token = t;
    tokenWaiters.forEach((w) => w(t));
    tokenWaiters = [];
  };

  async function ensureWidget(): Promise<void> {
    if (!siteKey || !turnstileBox || widgetId !== undefined) return;
    const api = await loadTurnstile().catch((err) => {
      console.warn('[lead] No se pudo cargar Turnstile', err);
      throw err;
    });
    if (widgetId !== undefined) return;
    widgetId = api.render(turnstileBox, {
      sitekey: siteKey,
      action: 'lead',
      appearance: 'interaction-only',
      language: 'es',
      callback: (t: string) => settleToken(t),
      'expired-callback': () => (token = undefined),
      'error-callback': (code: string) => {
        // Diagnóstico en consola: p. ej. 110200 = dominio no autorizado para esa sitekey.
        console.warn(`[lead] Turnstile error ${code}`);
        settleToken(undefined);
        return true;
      },
    });
  }

  async function getToken(): Promise<string | undefined> {
    if (!siteKey) return undefined; // Desarrollo local sin Turnstile.
    await ensureWidget();
    if (token) return token;
    return new Promise((resolve) => {
      tokenWaiters.push(resolve);
      setTimeout(() => resolve(token), TOKEN_TIMEOUT_MS);
    });
  }

  function resetToken() {
    token = undefined;
    if (widgetId !== undefined) window.turnstile?.reset(widgetId);
  }

  form.addEventListener('focusin', () => void ensureWidget().catch(() => undefined), { once: true });

  // --- Errores accesibles ---
  function controlFor(campo: Campo): HTMLElement | null {
    if (campo === 'interes') return form.querySelector('input[name="interes"]');
    return form.querySelector(`[name="${campo}"]`);
  }

  function clearErrors() {
    status!.textContent = '';
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
      const control = controlFor(el.dataset.errorFor as Campo);
      control?.removeAttribute('aria-invalid');
      if (control?.getAttribute('aria-describedby') === el.id) control.removeAttribute('aria-describedby');
    });
  }

  function showFieldErrors(fields: Partial<Record<Campo, string>>) {
    let first: HTMLElement | null = null;
    for (const [campo, mensaje] of Object.entries(fields) as [Campo, string][]) {
      const el = form.querySelector<HTMLElement>(`[data-error-for="${campo}"]`);
      const control = controlFor(campo);
      if (!el || !control) continue;
      el.textContent = mensaje;
      el.hidden = false;
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', el.id);
      first ??= control;
    }
    first?.focus();
  }

  function setBusy(busy: boolean) {
    sending = busy;
    button!.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
    button!.textContent = busy ? 'Enviando…' : ctaLabel;
  }

  const fallo = telefono
    ? `No hemos podido enviar tu solicitud. Inténtalo de nuevo o llámanos al ${telefono}.`
    : 'No hemos podido enviar tu solicitud. Inténtalo de nuevo.';

  // --- Envío ---
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    clearErrors();
    setBusy(true);

    try {
      const data = new FormData(form);
      const params = new URLSearchParams(window.location.search);
      const payload: Record<string, unknown> = {
        submission_id: submissionId,
        landing_id: data.get('landing_id'),
        nombre: data.get('nombre') ?? '',
        telefono: data.get('telefono') ?? '',
        email: data.get('email') ?? '',
        ciudad: data.get('ciudad') ?? '',
        interes: data.get('interes') ?? undefined,
        consentimiento: data.get('consentimiento') === 'on',
        website: data.get('website') ?? '',
        page_url: `${window.location.origin}${window.location.pathname}${window.location.search}`.slice(0, 2000),
      };
      for (const [key, max] of ATRIBUCION) {
        const value = params.get(key);
        if (value) payload[key] = value.slice(0, max);
      }

      let turnstileToken: string | undefined;
      try {
        turnstileToken = await getToken();
      } catch {
        turnstileToken = undefined;
      }
      if (siteKey && !turnstileToken) {
        status!.textContent = 'No hemos podido verificar el envío. Inténtalo de nuevo.';
        resetToken();
        setBusy(false);
        return;
      }
      payload.turnstile_token = turnstileToken;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({ ok: false }))) as LeadResponse;

      if (res.ok && body.ok) {
        // Lead guardado: se mantiene el estado ocupado hasta navegar.
        window.location.assign(thanks);
        return;
      }

      resetToken();
      setBusy(false);
      if (body.error === 'validation' && body.fields) {
        status!.textContent = 'Revisa los campos marcados.';
        showFieldErrors(body.fields);
      } else if (body.error === 'verification') {
        status!.textContent = 'No hemos podido verificar el envío. Inténtalo de nuevo.';
      } else {
        status!.textContent = fallo;
      }
    } catch {
      // Error de red: se conserva el submission_id para que el reintento no duplique.
      resetToken();
      setBusy(false);
      status!.textContent = fallo;
    }
  });

  // Volver atrás desde /gracias/ (bfcache): formulario listo para un envío nuevo.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    submissionId = newSubmissionId();
    clearErrors();
    resetToken();
    setBusy(false);
  });

  button.disabled = false;
}
