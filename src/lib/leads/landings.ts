/**
 * Landing de confianza para un lead: se resuelve desde las content collections
 * con las mismas reglas que el build (esPublicable + resolveLanding).
 * Lo que envía el cliente solo se usa como identificador.
 */
import { getEntry } from 'astro:content';
import { esPublicable, getOrganizacion, resolveLanding } from '../content';
import type { TrustedLanding } from './types';

export async function findTrustedLanding(landingId: string): Promise<TrustedLanding | undefined> {
  const landing = await getEntry('landings', landingId);
  if (!landing || !esPublicable(landing)) return undefined;

  const { tratamiento, localidad } = await resolveLanding(landing);
  const organizacion = await getOrganizacion();

  return {
    landingId: landing.id,
    tratamiento: tratamiento.id,
    tratamientoNombre: tratamiento.data.nombre,
    localidad: localidad?.id,
    localidadNombre: localidad?.data.nombre,
    interesOpciones: Object.fromEntries(tratamiento.data.interes_opciones.map((o) => [o.valor, o.label])),
    textoPrivacidad: organizacion.data.formulario.consentimiento,
  };
}
