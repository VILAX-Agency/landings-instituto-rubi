import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { INCLUDE_DRAFTS, INCLUDE_FIXTURES, buildLandingPath } from '../config/site';

export type TextoResponsive = string | { desktop: string; movil: string };

export type Landing = CollectionEntry<'landings'>;
export type Tratamiento = CollectionEntry<'tratamientos'>;
export type Localidad = CollectionEntry<'localidades'>;
export type Organizacion = CollectionEntry<'organizacion'>;
export type TipoSeccion = Landing['data']['secciones'][number]['tipo'];

export function textoPlano(value: TextoResponsive): string {
  return typeof value === 'string' ? value : value.desktop;
}

/** Marca textos de plantilla pendientes de validar: "[validar]", "[X]"... */
export function esMarcador(texto: string): boolean {
  return /^\[.*\]$/.test(texto.trim());
}

export async function getOrganizacion(): Promise<Organizacion> {
  const org = await getEntry('organizacion', 'instituto-rubi');
  if (!org) throw new Error('Falta src/content/organizacion/instituto-rubi.json');
  return org;
}

export interface LandingResuelta {
  landing: Landing;
  tratamiento: Tratamiento;
  localidad?: Localidad;
  path: string;
}

/** Resuelve referencias y valida coherencia (fixtures, secciones disponibles). */
export async function resolveLanding(landing: Landing): Promise<LandingResuelta> {
  const tratamiento = await getEntry(landing.data.tratamiento_slug);
  if (!tratamiento) {
    throw new Error(`Landing "${landing.id}": tratamiento "${landing.data.tratamiento_slug.id}" no existe.`);
  }
  const localidad = landing.data.localidad_slug ? await getEntry(landing.data.localidad_slug) : undefined;
  if (landing.data.localidad_slug && !localidad) {
    throw new Error(`Landing "${landing.id}": localidad "${landing.data.localidad_slug.id}" no existe.`);
  }

  const usaFixture = tratamiento.data.fixture || Boolean(localidad?.data.fixture);
  if (usaFixture && !landing.data.fixture) {
    throw new Error(
      `Landing "${landing.id}" usa datos ficticios (fixture) pero no está marcada como "fixture": true.`,
    );
  }
  if (landing.data.fixture && landing.data.estado === 'aprobado') {
    throw new Error(`Landing "${landing.id}": una landing ficticia no puede estar "aprobado".`);
  }

  for (const { tipo } of landing.data.secciones) {
    // hero y confianza salen de landing/organización; cta_final es obligatorio en el esquema.
    if (tipo === 'hero' || tipo === 'confianza' || tipo === 'cta_final') continue;
    if (!tratamiento.data.secciones[tipo]) {
      throw new Error(
        `Landing "${landing.id}" pide la sección "${tipo}", pero el tratamiento "${tratamiento.id}" no la define.`,
      );
    }
  }

  return {
    landing,
    tratamiento,
    localidad,
    path: buildLandingPath(tratamiento.id, localidad?.id),
  };
}

export function esPublicable(landing: Landing): boolean {
  if (landing.data.fixture && !INCLUDE_FIXTURES) return false;
  if (landing.data.estado !== 'aprobado' && !INCLUDE_DRAFTS) return false;
  return true;
}

/** Todas las landings que entran en el build, con rutas únicas garantizadas. */
export async function getLandingsResueltas(): Promise<LandingResuelta[]> {
  const landings = await getCollection('landings');
  const resueltas = await Promise.all(landings.filter(esPublicable).map(resolveLanding));

  const vistos = new Map<string, string>();
  for (const r of resueltas) {
    const previa = vistos.get(r.path);
    if (previa) {
      throw new Error(`URL duplicada ${r.path}: landings "${previa}" y "${r.landing.id}".`);
    }
    vistos.set(r.path, r.landing.id);
  }
  return resueltas.sort((a, b) => a.path.localeCompare(b.path));
}
