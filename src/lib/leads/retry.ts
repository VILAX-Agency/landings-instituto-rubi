/**
 * Reintento de notificaciones pendientes o fallidas (cron horario).
 *
 * claimRetryable() reclama las filas de forma atómica: solo quien recibe una
 * fila la envía. La clave de idempotencia de Resend cubre el hueco entre
 * "enviado" y "estado guardado". Entrega al menos una vez.
 */
import { buildNotification } from './handleLead';
import type { LeadNotification, LeadStore, NotifyResult, TrustedLanding } from './types';

export const MAX_ATTEMPTS = 5;

export interface RetryDeps {
  store: LeadStore;
  notify(n: LeadNotification): Promise<NotifyResult>;
  findLanding(landingId: string): Promise<TrustedLanding | undefined>;
  log?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export interface RetrySummary {
  claimed: number;
  sent: number;
  failed: number;
  exhausted: number;
}

export async function retryNotifications(deps: RetryDeps, maxRows = 20): Promise<RetrySummary> {
  const log = deps.log ?? console;
  const rows = await deps.store.claimRetryable(maxRows);
  const summary: RetrySummary = { claimed: rows.length, sent: 0, failed: 0, exhausted: 0 };

  for (const row of rows) {
    let result: NotifyResult;
    try {
      const landing = await deps.findLanding(row.landing_id).catch(() => undefined);
      result = await deps.notify(buildNotification(row, landing));
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : 'error' };
    }

    if (result.ok) {
      summary.sent++;
    } else {
      summary.failed++;
      if (row.notification_attempts >= MAX_ATTEMPTS) {
        summary.exhausted++;
        log.error(`[lead] notificación agotada tras ${row.notification_attempts} intentos (${row.submission_id}): revisar a mano`);
      }
    }

    try {
      await deps.store.finishNotification(row.submission_id, result);
    } catch (err) {
      log.error(`[lead] no se pudo registrar el estado (${row.submission_id}): ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  if (rows.length) log.info(`[lead] reintentos: ${JSON.stringify(summary)}`);
  return summary;
}
