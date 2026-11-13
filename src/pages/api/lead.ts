/** POST /api/lead/ — recepción de leads del formulario (Fase 2). */
import type { APIRoute } from 'astro';
import { handleLead, isLeadResult, readJsonBody, type LeadResult } from '../../lib/leads/handleLead';
import { getLeadDeps, leadsEnabled } from '../../lib/leads/server';

export const prerender = false;

const json = ({ status, body }: LeadResult) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  const deps = leadsEnabled ? getLeadDeps() : undefined;
  if (!deps) {
    if (leadsEnabled) console.error('[lead] Supabase no configurado (SUPABASE_URL / SUPABASE_SECRET_KEY).');
    return json({ status: 503, body: { ok: false, error: 'unavailable' } });
  }

  const body = await readJsonBody(request);
  if (isLeadResult(body)) return json(body);

  return json(await handleLead(body, deps));
};
