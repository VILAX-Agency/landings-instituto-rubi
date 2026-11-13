import { describe, expect, it, vi } from 'vitest';
import { SupabaseError, createSupabaseStore } from '../src/lib/leads/db';
import { SID, row } from './fixtures';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const callOf = (f: ReturnType<typeof vi.fn>, i = 0) => f.mock.calls[i] as unknown as [string, RequestInit];

describe('createSupabaseStore', () => {
  it('insertLead: created / duplicate según la respuesta', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json([{ submission_id: SID }], 201)).mockResolvedValueOnce(json([], 201));
    const store = createSupabaseStore('https://p.supabase.co/', 'sb_secret_x', fetchMock);
    expect(await store.insertLead(row())).toBe('created');
    expect(await store.insertLead(row())).toBe('duplicate');

    const [url, init] = callOf(fetchMock);
    expect(url).toBe('https://p.supabase.co/rest/v1/leads?on_conflict=submission_id&select=submission_id');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_x');
    expect(headers.Authorization).toBeUndefined();
    expect(headers.Prefer).toBe('return=representation,resolution=ignore-duplicates');
  });

  it('clave heredada (JWT) también va en Authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([], 201));
    await createSupabaseStore('https://p.supabase.co', 'eyJhbGciOi.x.y', fetchMock).insertLead(row());
    expect((callOf(fetchMock)[1].headers as Record<string, string>).Authorization).toBe('Bearer eyJhbGciOi.x.y');
  });

  it('error HTTP → SupabaseError', async () => {
    const store = createSupabaseStore('https://p.supabase.co', 'k', vi.fn().mockResolvedValue(json({ message: 'x' }, 500)));
    await expect(store.insertLead(row())).rejects.toBeInstanceOf(SupabaseError);
  });

  it('finishNotification: sent / failed y libera la reclamación', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const store = createSupabaseStore('https://p.supabase.co', 'k', fetchMock);
    await store.finishNotification(SID, { ok: true });
    await store.finishNotification(SID, { ok: false, error: 'e'.repeat(900) });

    const [url, init] = callOf(fetchMock);
    expect(url).toBe(`https://p.supabase.co/rest/v1/leads?submission_id=eq.${SID}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toMatchObject({ notification_status: 'sent', notification_claimed_at: null });
    const failed = JSON.parse(callOf(fetchMock, 1)[1].body as string);
    expect(failed).toMatchObject({ notification_status: 'failed', notification_claimed_at: null });
    expect(failed.notification_error).toHaveLength(500);
  });

  it('claimRetryable llama a la función RPC', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([row()]));
    const rows = await createSupabaseStore('https://p.supabase.co', 'k', fetchMock).claimRetryable(20);
    expect(rows).toHaveLength(1);
    const [url, init] = callOf(fetchMock);
    expect(url).toBe('https://p.supabase.co/rest/v1/rpc/claim_retryable_notifications');
    expect(JSON.parse(init.body as string)).toEqual({ max_rows: 20 });
  });
});
