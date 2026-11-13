import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from '../src/lib/leads/turnstile';

const res = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('verifyTurnstile', () => {
  it('acepta solo success: true', async () => {
    expect(await verifyTurnstile('t', 's', res({ success: true }))).toBe(true);
    expect(await verifyTurnstile('t', 's', res({ success: false }))).toBe(false);
  });

  it('sin token no llama a Cloudflare', async () => {
    const f = res({ success: true });
    expect(await verifyTurnstile(undefined, 's', f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('falla cerrado ante errores', async () => {
    expect(await verifyTurnstile('t', 's', res({}, 500))).toBe(false);
    expect(await verifyTurnstile('t', 's', vi.fn(async () => Promise.reject(new Error('x'))))).toBe(false);
  });

  it('no envía la IP del usuario', async () => {
    const f = res({ success: true });
    await verifyTurnstile('t', 's', f);
    const body = (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect([...body.keys()]).toEqual(['secret', 'response']);
  });
});
