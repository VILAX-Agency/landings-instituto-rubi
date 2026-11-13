/**
 * Cliente mínimo de Supabase (API REST/PostgREST) con la clave secreta.
 * Solo servidor. Sin SDK: tres operaciones.
 */
import type { LeadRow, LeadStore, NotifyResult } from './types';

const TIMEOUT_MS = 8000;

export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export function createSupabaseStore(
  baseUrl: string,
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): LeadStore {
  const rest = `${baseUrl.replace(/\/+$/, '')}/rest/v1`;
  const headers: Record<string, string> = {
    apikey: secretKey,
    'Content-Type': 'application/json',
  };
  // Las claves heredadas (service_role) son JWT y también van en Authorization.
  // Las nuevas (sb_secret_...) solo en `apikey`.
  if (secretKey.startsWith('eyJ')) headers.Authorization = `Bearer ${secretKey}`;

  async function call(path: string, init: RequestInit & { prefer?: string }): Promise<Response> {
    const res = await fetchImpl(`${rest}${path}`, {
      ...init,
      headers: { ...headers, ...(init.prefer ? { Prefer: init.prefer } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // El cuerpo de error de PostgREST no contiene los datos enviados.
      const detail = await res.text().catch(() => '');
      throw new SupabaseError(`Supabase ${res.status}: ${detail.slice(0, 300)}`, res.status);
    }
    return res;
  }

  return {
    async insertLead(row: LeadRow) {
      const res = await call('/leads?on_conflict=submission_id&select=submission_id', {
        method: 'POST',
        body: JSON.stringify(row),
        prefer: 'return=representation,resolution=ignore-duplicates',
      });
      const rows = (await res.json()) as unknown[];
      return rows.length > 0 ? 'created' : 'duplicate';
    },

    async finishNotification(submissionId: string, result: NotifyResult) {
      const body = result.ok
        ? {
            notification_status: 'sent',
            notified_at: new Date().toISOString(),
            notification_error: null,
            notification_claimed_at: null,
          }
        : {
            notification_status: 'failed',
            notification_error: result.error.slice(0, 500),
            notification_claimed_at: null,
          };
      await call(`/leads?submission_id=eq.${encodeURIComponent(submissionId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        prefer: 'return=minimal',
      });
    },

    async claimRetryable(maxRows: number) {
      const res = await call('/rpc/claim_retryable_notifications', {
        method: 'POST',
        body: JSON.stringify({ max_rows: maxRows }),
      });
      return (await res.json()) as LeadRow[];
    },
  };
}
