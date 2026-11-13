import { vi } from 'vitest';
import type { LeadDeps } from '../src/lib/leads/handleLead';
import type { LeadRow, LeadStore, TrustedLanding } from '../src/lib/leads/types';

export const SID = '7d1c7a52-5b0f-4b7e-9f5e-3f0a1c2b4d6e';

export const landing: TrustedLanding = {
  landingId: 'aumento-pecho-aba',
  tratamiento: 'aumento-pecho',
  tratamientoNombre: 'Aumento de pecho',
  interesOpciones: { 'aumento-pecho': 'Aumento de pecho', elevacion: 'Elevación' },
  textoPrivacidad: 'Acepto la política de privacidad.',
};

export function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    submission_id: SID,
    landing_id: 'aumento-pecho-aba',
    nombre: 'Ana',
    telefono: '600 000 000',
    email: 'Ana@Example.com',
    ciudad: 'mallorca',
    interes: 'aumento-pecho',
    consentimiento: true,
    page_url: 'https://tratamiento.institutorubi.com/aumento-pecho/?utm_source=google',
    utm_source: 'google',
    gclid: 'abc',
    turnstile_token: 'token',
    website: '',
    ...overrides,
  };
}

export function fakeStore(overrides: Partial<LeadStore> = {}) {
  const base = {
    insertLead: vi.fn<LeadStore['insertLead']>(async () => 'created'),
    finishNotification: vi.fn<LeadStore['finishNotification']>(async () => {}),
    claimRetryable: vi.fn<LeadStore['claimRetryable']>(async () => []),
  };
  return { ...base, ...overrides } as typeof base;
}

export const silentLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

export function fakeDeps(overrides: Partial<LeadDeps> = {}) {
  const store = fakeStore();
  const base = {
    store,
    notify: vi.fn<LeadDeps['notify']>(async () => ({ ok: true })),
    verifyTurnstile: vi.fn<LeadDeps['verifyTurnstile']>(async () => true),
    findLanding: vi.fn<LeadDeps['findLanding']>(async (id) => (id === landing.landingId ? landing : undefined)),
    now: () => new Date('2026-11-13T10:00:00Z'),
    log: silentLog,
  };
  // Las sustituciones conservan los tipos Mock para poder inspeccionarlas.
  return { ...base, ...overrides } as typeof base;
}

export function row(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    submission_id: SID,
    created_at: '2026-11-13T10:00:00Z',
    landing_id: 'aumento-pecho-aba',
    tratamiento: 'aumento-pecho',
    localidad: null,
    nombre: 'Ana',
    telefono: '+34600000000',
    email: null,
    ciudad: 'mallorca',
    interes: 'aumento-pecho',
    privacy_notice_version: 'abc',
    privacy_acknowledged_at: '2026-11-13T10:00:00Z',
    page_url: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    gclid: null,
    fbclid: null,
    notification_status: 'failed',
    notification_attempts: 2,
    notification_claimed_at: '2026-11-13T10:00:00Z',
    ...overrides,
  };
}
