import { describe, expect, it, vi } from 'vitest';
import {
  MAX_BODY_BYTES,
  buildNotification,
  handleLead,
  isLeadResult,
  privacyNoticeVersion,
  readJsonBody,
} from '../src/lib/leads/handleLead';
import { SID, fakeDeps, fakeStore, landing, row, validInput } from './fixtures';

describe('handleLead', () => {
  it('guarda, notifica y marca como enviado', async () => {
    const deps = fakeDeps();
    const res = await handleLead(validInput(), deps);

    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(deps.store.insertLead).toHaveBeenCalledTimes(1);
    const stored = deps.store.insertLead.mock.calls[0][0];
    expect(stored).toMatchObject({
      submission_id: SID,
      tratamiento: 'aumento-pecho',
      localidad: null,
      telefono: '+34600000000',
      email: 'ana@example.com',
      ciudad: 'mallorca',
      notification_status: 'pending',
      notification_attempts: 1,
      notification_claimed_at: '2026-11-13T10:00:00.000Z',
      privacy_acknowledged_at: '2026-11-13T10:00:00.000Z',
      utm_source: 'google',
      gclid: 'abc',
    });
    expect(stored).not.toHaveProperty('turnstile_token');
    expect(stored).not.toHaveProperty('website');
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(deps.store.finishNotification).toHaveBeenCalledWith(SID, { ok: true });
  });

  it('toma tratamiento y localidad del contenido, no del cliente', async () => {
    const deps = fakeDeps();
    await handleLead(validInput({ tratamiento: 'otro', localidad: 'falsa' }), deps);
    const stored = deps.store.insertLead.mock.calls[0][0];
    expect(stored.tratamiento).toBe('aumento-pecho');
    expect(stored.localidad).toBeNull();
  });

  it('honeypot: éxito aparente sin guardar ni verificar', async () => {
    const deps = fakeDeps();
    const res = await handleLead(validInput({ website: 'http://spam' }), deps);
    expect(res.status).toBe(200);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(deps.store.insertLead).not.toHaveBeenCalled();
  });

  it('Turnstile fallido → 403 sin guardar', async () => {
    const deps = fakeDeps({ verifyTurnstile: vi.fn(async () => false) });
    const res = await handleLead(validInput(), deps);
    expect(res).toEqual({ status: 403, body: { ok: false, error: 'verification' } });
    expect(deps.store.insertLead).not.toHaveBeenCalled();
  });

  it('pasa el token de Turnstile al verificador', async () => {
    const deps = fakeDeps();
    await handleLead(validInput({ turnstile_token: 'abc' }), deps);
    expect(deps.verifyTurnstile).toHaveBeenCalledWith('abc');
  });

  it('validación → 400 con errores por campo', async () => {
    const deps = fakeDeps();
    const res = await handleLead(validInput({ nombre: '', telefono: '1' }), deps);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, error: 'validation', fields: { nombre: expect.any(String), telefono: expect.any(String) } });
    expect(deps.store.insertLead).not.toHaveBeenCalled();
  });

  it('landing desconocida o no publicable → 400', async () => {
    const deps = fakeDeps();
    const res = await handleLead(validInput({ landing_id: 'no-existe' }), deps);
    expect(res).toEqual({ status: 400, body: { ok: false, error: 'payload' } });
    expect(deps.store.insertLead).not.toHaveBeenCalled();
  });

  it('interés no permitido para el tratamiento → 400', async () => {
    const deps = fakeDeps();
    const res = await handleLead(validInput({ interes: 'rinoplastia' }), deps);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'validation', fields: { interes: expect.any(String) } });
  });

  it('cuerpo que no es objeto → 400', async () => {
    for (const raw of [null, 'x', [1, 2]]) {
      expect((await handleLead(raw, fakeDeps())).status).toBe(400);
    }
  });

  it('submission_id repetido → éxito sin volver a notificar', async () => {
    const deps = fakeDeps({ store: fakeStore({ insertLead: vi.fn(async () => 'duplicate' as const) }) });
    const res = await handleLead(validInput(), deps);
    expect(res.status).toBe(200);
    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.store.finishNotification).not.toHaveBeenCalled();
  });

  it('fallo de base de datos → 503 y nunca éxito', async () => {
    const deps = fakeDeps({
      store: fakeStore({ insertLead: vi.fn(async () => Promise.reject(new Error('down'))) }),
    });
    const res = await handleLead(validInput(), deps);
    expect(res).toEqual({ status: 503, body: { ok: false, error: 'unavailable' } });
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('email fallido → lead guardado, estado failed y éxito', async () => {
    const deps = fakeDeps({ notify: vi.fn(async () => ({ ok: false as const, error: 'Resend 500' })) });
    const res = await handleLead(validInput(), deps);
    expect(res.status).toBe(200);
    expect(deps.store.finishNotification).toHaveBeenCalledWith(SID, { ok: false, error: 'Resend 500' });
  });

  it('el notificador lanza → estado failed y éxito', async () => {
    const deps = fakeDeps({ notify: vi.fn(async () => Promise.reject(new Error('boom'))) });
    const res = await handleLead(validInput(), deps);
    expect(res.status).toBe(200);
    expect(deps.store.finishNotification).toHaveBeenCalledWith(SID, { ok: false, error: 'boom' });
  });

  it('no poder registrar el estado no invalida el lead', async () => {
    const deps = fakeDeps({
      store: fakeStore({ finishNotification: vi.fn(async () => Promise.reject(new Error('down'))) }),
    });
    expect((await handleLead(validInput(), deps)).status).toBe(200);
  });

  it('los logs no contienen datos personales', async () => {
    const deps = fakeDeps({ notify: vi.fn(async () => ({ ok: false as const, error: 'x' })) });
    await handleLead(validInput(), deps);
    const logged = JSON.stringify([deps.log.info.mock.calls, deps.log.warn.mock.calls, deps.log.error.mock.calls]);
    for (const dato of ['Ana', '600', 'example.com']) expect(logged).not.toContain(dato);
  });
});

describe('buildNotification', () => {
  it('contenido mínimo con etiquetas legibles', () => {
    const n = buildNotification(row({ email: 'a@b.es', utm_source: 'google', page_url: 'https://x' }), landing);
    expect(n).toEqual({
      submissionId: SID,
      createdAt: '2026-11-13T10:00:00Z',
      nombre: 'Ana',
      telefono: '+34600000000',
      email: 'a@b.es',
      ciudad: 'Mallorca',
      interes: 'Aumento de pecho',
      landing: 'Aumento de pecho (aumento-pecho-aba)',
    });
  });

  it('sin landing usa los valores guardados', () => {
    const n = buildNotification(row({ ciudad: 'desconocida' }));
    expect(n.landing).toBe('aumento-pecho-aba (aumento-pecho-aba)');
    expect(n.ciudad).toBe('desconocida');
    expect(n.interes).toBe('aumento-pecho');
  });
});

describe('privacyNoticeVersion', () => {
  it('es estable y cambia con el texto', async () => {
    const a = await privacyNoticeVersion('Texto A');
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(await privacyNoticeVersion(' Texto A ')).toBe(a);
    expect(await privacyNoticeVersion('Texto B')).not.toBe(a);
  });
});

describe('readJsonBody', () => {
  const req = (body: string, type = 'application/json') =>
    new Request('http://x/api/lead/', { method: 'POST', headers: { 'content-type': type }, body });

  it('lee JSON válido', async () => {
    expect(await readJsonBody(req('{"a":1}'))).toEqual({ a: 1 });
  });

  it('415 si no es JSON', async () => {
    const r = await readJsonBody(req('a=1', 'application/x-www-form-urlencoded'));
    expect(isLeadResult(r) && r.status).toBe(415);
  });

  it('413 si supera el límite', async () => {
    const r = await readJsonBody(req(JSON.stringify({ a: 'x'.repeat(MAX_BODY_BYTES) })));
    expect(isLeadResult(r) && r.status).toBe(413);
  });

  it('400 si el JSON es inválido', async () => {
    const r = await readJsonBody(req('{nope'));
    expect(isLeadResult(r) && r.status).toBe(400);
  });
});
