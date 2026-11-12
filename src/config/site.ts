/**
 * Configuración global del sistema de landings.
 *
 * Única fuente de verdad para construir URLs: ningún componente ni página
 * debe concatenar rutas de landings a mano; siempre `buildLandingPath()`.
 */

export const SITE_URL = 'https://institutorubi.com';

const SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeBase(raw: string | undefined): string {
  const value = (raw ?? 'tratamientos').trim().replace(/^\/+|\/+$/g, '');
  if (value === '') return '';
  const segments = value.split('/');
  for (const segment of segments) {
    if (!SEGMENT_RE.test(segment)) {
      throw new Error(
        `PUBLIC_LANDINGS_BASE inválido ("${raw}"): usa minúsculas, números y guiones, sin tildes.`,
      );
    }
  }
  return segments.join('/');
}

/** Prefijo de URL de las landings. Configurable: `tratamientos`, `campanas`, etc. */
export const LANDINGS_BASE_PATH = normalizeBase(import.meta.env.PUBLIC_LANDINGS_BASE);

/** Incluir landings no aprobadas en el build (previsualización). */
export const INCLUDE_DRAFTS = import.meta.env.PUBLIC_INCLUDE_DRAFTS !== 'false';

/** Incluir landings ficticias de prueba. Nunca en un build de publicación. */
export const INCLUDE_FIXTURES = import.meta.env.PUBLIC_INCLUDE_FIXTURES !== 'false';

/**
 * Las landings de campaña no se indexan ni entran en el sitemap SEO
 * (decisión de Fase 1). Centralizado aquí para poder revisarlo en un solo punto.
 */
export const CAMPAIGN_ROBOTS = 'noindex, nofollow';

export function assertSlug(slug: string, field: string): string {
  if (!SEGMENT_RE.test(slug)) {
    throw new Error(`Slug inválido en "${field}": "${slug}". Usa minúsculas, números y guiones.`);
  }
  return slug;
}

/** Ruta relativa con barra final: `/{base}/{tratamiento}/{localidad?}/`. */
export function buildLandingPath(tratamiento: string, localidad?: string): string {
  const parts = [LANDINGS_BASE_PATH, assertSlug(tratamiento, 'tratamiento')];
  if (localidad) parts.push(assertSlug(localidad, 'localidad'));
  return `/${parts.filter(Boolean).join('/')}/`;
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}
