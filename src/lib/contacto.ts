import type { Localidad, Organizacion } from './content';

export interface Contacto {
  telefonoDisplay: string;
  telHref: string;
  /** undefined = pendiente de configurar (los botones se pintan inactivos). */
  whatsappUrl?: string;
  googleReviewsUrl?: string;
}

/** Datos de contacto efectivos: la localidad prevalece sobre la organización. */
export function resolveContacto(org: Organizacion, localidad?: Localidad): Contacto {
  const tel = localidad?.data.telefono ?? org.data.telefono;
  return {
    telefonoDisplay: tel.display,
    telHref: `tel:${tel.e164}`,
    whatsappUrl: localidad?.data.whatsapp_url ?? org.data.whatsapp_url,
    googleReviewsUrl: org.data.google_reviews_url,
  };
}
