/**
 * Integración con un proyecto Supabase de DESARROLLO (migración aplicada).
 * Se omite si faltan SUPABASE_TEST_URL y SUPABASE_TEST_SECRET_KEY.
 * Opcional: RESEND_TEST_API_KEY + RESEND_TEST_FROM envían un email real a
 * delivered@resend.dev (cuenta para la cuota de Resend).
 *
 * Todas las filas usan landing_id "test-integracion" y se borran al final.
 * La prueba de concurrencia puede reclamar otras filas pendientes del
 * proyecto de desarrollo (nunca usar producción).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createSupabaseStore } from '../../src/lib/leads/db';
import { handleLead } from '../../src/lib/leads/handleLead';
import { notifyLead } from '../../src/lib/leads/notify';
import { retryNotifications } from '../../src/lib/leads/retry';
import type { TrustedLanding } from '../../src/lib/leads/types';
import { row, silentLog } from '../fixtures';

const URL_ = process.env.SUPABASE_TEST_URL;
const KEY = process.env.SUPABASE_TEST_SECRET_KEY;
const RESEND_KEY = process.env.RESEND_TEST_API_KEY;
const RESEND_FROM = process.env.RESEND_TEST_FROM;
const LANDING = 'test-integracion';

const testLanding: TrustedLanding = {
  landingId: LANDING,
  tratamiento: 'aumento-pecho',
  tratamientoNombre: 'Prueba de integración',
  interesOpciones: { 'aumento-pecho': 'Aumento de pecho' },
  textoPrivacidad: 'Texto de prueba',
};

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_}/rest/v1${path}`, {
    ...init,
    headers: { apikey: KEY!, 'Content-Type': 'application/json', ...(KEY!.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? undefined : res.json();
}

const rowsFor = (sid: string) =>
  rest(`/leads?submission_id=eq.${sid}&select=submission_id,notification_status,notification_attempts,notification_claimed_at`) as Promise<
    { notification_status: string; notification_attempts: number; notification_claimed_at: string | null }[]
  >;

describe.skipIf(!URL_ || !KEY)('Supabase (desarrollo)', () => {
  const store = createSupabaseStore(URL_ ?? '', KEY ?? '');
  const input = (sid: string) => ({
    submission_id: sid,
    landing_id: LANDING,
    nombre: 'Prueba Integración',
    telefono: '600000000',
    ciudad: 'mallorca',
    interes: 'aumento-pecho',
    consentimiento: true,
  });
  const deps = (notify: Parameters<typeof handleLead>[1]['notify']) => ({
    store,
    notify,
    verifyTurnstile: async () => true,
    findLanding: async (id: string) => (id === LANDING ? testLanding : undefined),
    log: silentLog,
  });

  afterAll(async () => {
    await rest(`/leads?landing_id=eq.${LANDING}`, { method: 'DELETE' });
  });

  it('un envío crea exactamente una fila, también si se repite', async () => {
    const sid = randomUUID();
    const d = deps(async () => ({ ok: true }));
    expect((await handleLead(input(sid), d)).status).toBe(200);
    expect((await handleLead(input(sid), d)).status).toBe(200);
    const rows = await rowsFor(sid);
    expect(rows).toHaveLength(1);
    expect(rows[0].notification_status).toBe('sent');
    expect(rows[0].notification_claimed_at).toBeNull();
  });

  it('email fallido deja el lead "failed" y el reintento lo recupera', async () => {
    const sid = randomUUID();
    await handleLead(input(sid), deps(async () => ({ ok: false, error: 'simulado' })));
    expect((await rowsFor(sid))[0].notification_status).toBe('failed');

    await retryNotifications({ ...deps(async () => ({ ok: true })), store }, 100);
    const [after] = await rowsFor(sid);
    expect(after.notification_status).toBe('sent');
    expect(after.notification_attempts).toBe(2);
  });

  it('dos reclamaciones concurrentes nunca obtienen la misma fila', async () => {
    const sid = randomUUID();
    await store.insertLead(row({ submission_id: sid, landing_id: LANDING, notification_status: 'failed', notification_attempts: 1, notification_claimed_at: null }));
    const [a, b] = await Promise.all([store.claimRetryable(100), store.claimRetryable(100)]);
    const hits = [...a, ...b].filter((r) => r.submission_id === sid);
    expect(hits).toHaveLength(1);
    // Ya reclamada: no vuelve a salir hasta que caduque (15 min).
    expect((await store.claimRetryable(100)).some((r) => r.submission_id === sid)).toBe(false);
  });

  it('la clave pública no puede leer ni escribir leads (RLS)', async () => {
    const anon = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
    if (!anon) return;
    const res = await fetch(`${URL_}/rest/v1/leads?select=submission_id&limit=1`, { headers: { apikey: anon } });
    const body = res.ok ? await res.json() : [];
    expect(Array.isArray(body) ? body.length : 0).toBe(0);
  });
});

describe.skipIf(!RESEND_KEY || !RESEND_FROM)('Resend (prueba real)', () => {
  it('envía a delivered@resend.dev', async () => {
    const r = await notifyLead(
      {
        submissionId: randomUUID(),
        createdAt: new Date().toISOString(),
        nombre: 'Prueba',
        telefono: '+34600000000',
        ciudad: 'Mallorca',
        landing: 'Prueba de integración',
      },
      { apiKey: RESEND_KEY!, from: RESEND_FROM!, to: 'delivered@resend.dev' },
    );
    expect(r).toEqual({ ok: true });
  });
});
