/**
 * GET /api/cron/notificaciones/ — reintento horario (Vercel Cron, vercel.json).
 * Vercel envía `Authorization: Bearer ${CRON_SECRET}`.
 * La lectura horaria también mantiene activo el proyecto Supabase Free.
 */
import type { APIRoute } from 'astro';
import { retryNotifications } from '../../../lib/leads/retry';
import { getRetryDeps, isAuthorizedCron } from '../../../lib/leads/server';

export const prerender = false;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request.headers.get('authorization'))) return json(401, { ok: false });

  const deps = getRetryDeps();
  if (!deps) return json(503, { ok: false, error: 'unavailable' });

  try {
    return json(200, { ok: true, ...(await retryNotifications(deps)) });
  } catch (err) {
    console.error(`[lead] cron de reintentos: ${err instanceof Error ? err.message : 'error'}`);
    return json(503, { ok: false, error: 'unavailable' });
  }
};
