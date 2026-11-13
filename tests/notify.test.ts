import { describe, expect, it, vi } from 'vitest';
import { buildEmail, notifyLead, parseRecipients } from '../src/lib/leads/notify';
import type { LeadNotification } from '../src/lib/leads/types';
import { SID } from './fixtures';

const n: LeadNotification = {
  submissionId: SID,
  createdAt: '2026-11-13T10:00:00Z',
  nombre: 'Ana <script>',
  telefono: '+34600000000',
  email: 'ana@example.com',
  ciudad: 'Mallorca',
  interes: 'Aumento de pecho',
  landing: 'Aumento de pecho (aumento-pecho-aba)',
};
const config = { apiKey: 're_test', from: 'Leads <leads@example.com>', to: 'a@example.com, b@example.com' };
const ok = () => vi.fn(async () => new Response('{"id":"1"}', { status: 200 }));

describe('notifyLead', () => {
  it('envía con clave de idempotencia, destinatarios y reply_to', async () => {
    const fetchMock = ok();
    expect(await notifyLead(n, config, fetchMock)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe(`lead/${SID}`);
    expect(headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['a@example.com', 'b@example.com']);
    expect(body.reply_to).toBe('ana@example.com');
    expect(body.from).toBe(config.from);
  });

  it('sin email del lead no añade reply_to', async () => {
    const fetchMock = ok();
    await notifyLead({ ...n, email: undefined }, config, fetchMock);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).not.toHaveProperty('reply_to');
  });

  it('error de Resend → resultado fallido', async () => {
    const fetchMock = vi.fn(async () => new Response('{"name":"rate_limit_exceeded"}', { status: 429 }));
    const r = await notifyLead(n, config, fetchMock);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('429');
  });

  it('red caída → resultado fallido', async () => {
    const r = await notifyLead(n, config, vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    expect(r).toEqual({ ok: false, error: 'Resend sin respuesta: TypeError' });
  });

  it('sin configuración no llama a Resend', async () => {
    const fetchMock = ok();
    expect(await notifyLead(n, undefined, fetchMock)).toEqual({ ok: false, error: 'Resend no configurado' });
    expect(await notifyLead(n, { ...config, to: ' , ' }, fetchMock)).toEqual({ ok: false, error: 'LEADS_EMAIL_TO vacío' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('buildEmail', () => {
  it('contenido mínimo y HTML escapado', () => {
    const { subject, text, html } = buildEmail(n);
    expect(subject).toBe('Nueva solicitud de valoración · Mallorca');
    expect(text).toContain('Teléfono: +34600000000');
    expect(text).toContain(`Referencia: ${SID}`);
    expect(html).toContain('Ana &lt;script&gt;');
    expect(html).not.toContain('<script>');
    for (const campo of ['utm', 'gclid', 'http']) expect(text.toLowerCase()).not.toContain(campo);
  });

  it('parseRecipients ignora vacíos', () => {
    expect(parseRecipients(' a@x.es ,, b@x.es ')).toEqual(['a@x.es', 'b@x.es']);
  });
});
