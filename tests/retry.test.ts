import { describe, expect, it, vi } from 'vitest';
import { MAX_ATTEMPTS, retryNotifications } from '../src/lib/leads/retry';
import { fakeStore, landing, row, silentLog } from './fixtures';

const deps = (store = fakeStore(), notify = vi.fn(async () => ({ ok: true as const }))) => ({
  store,
  notify,
  findLanding: vi.fn(async () => landing),
  log: silentLog,
});

describe('retryNotifications', () => {
  it('solo envía las filas reclamadas y registra el resultado', async () => {
    const a = row({ submission_id: '00000000-0000-4000-8000-000000000001' });
    const b = row({ submission_id: '00000000-0000-4000-8000-000000000002' });
    const store = fakeStore({ claimRetryable: vi.fn(async () => [a, b]) });
    const notify = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: 'x' });
    const summary = await retryNotifications(deps(store, notify), 20);

    expect(store.claimRetryable).toHaveBeenCalledWith(20);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(store.finishNotification).toHaveBeenCalledWith(a.submission_id, { ok: true });
    expect(store.finishNotification).toHaveBeenCalledWith(b.submission_id, { ok: false, error: 'x' });
    expect(summary).toEqual({ claimed: 2, sent: 1, failed: 1, exhausted: 0 });
  });

  it('sin filas reclamadas no envía nada', async () => {
    const d = deps();
    expect(await retryNotifications(d)).toEqual({ claimed: 0, sent: 0, failed: 0, exhausted: 0 });
    expect(d.notify).not.toHaveBeenCalled();
  });

  it('marca como agotado el último intento fallido', async () => {
    const store = fakeStore({ claimRetryable: vi.fn(async () => [row({ notification_attempts: MAX_ATTEMPTS })]) });
    const summary = await retryNotifications(deps(store, vi.fn(async () => Promise.reject(new Error('down')))));
    expect(summary.exhausted).toBe(1);
    expect(store.finishNotification).toHaveBeenCalledWith(row().submission_id, { ok: false, error: 'down' });
  });

  it('usa etiquetas de la landing cuando existe', async () => {
    const store = fakeStore({ claimRetryable: vi.fn(async () => [row()]) });
    const d = deps(store);
    await retryNotifications(d);
    expect(d.notify.mock.calls[0]).toEqual([expect.objectContaining({ interes: 'Aumento de pecho', ciudad: 'Mallorca' })]);
  });
});
