/**
 * Configuración del formulario de captación (Fase 2).
 *
 * El formulario es operativo solo con `PUBLIC_LEADS_ENABLED=true`: envía JSON
 * a `endpoint` (ver src/pages/api/lead.ts). Sin esa variable se mantiene el
 * comportamiento "no operativo" de Fase 1 (botón deshabilitado y aviso).
 * El contrato de datos y su validación están en src/lib/leads/schema.ts.
 * Este fichero lo usan cliente y servidor: no puede contener secretos.
 */

export interface LeadFormConfig {
  /** Ruta del endpoint de leads. undefined = formulario no operativo. */
  endpoint?: string;
  /** Página de destino tras un envío confirmado. */
  thanksPath: string;
  /** Clave pública de Cloudflare Turnstile (vacía en desarrollo local). */
  turnstileSiteKey?: string;
}

export interface CiudadFormulario {
  /** Valor enviado (slug en minúscula, sin tildes). */
  valor: string;
  label: string;
}

/**
 * Ciudades del desplegable del formulario.
 * PROVISIONAL: lista de prueba pendiente de confirmar por el cliente/equipo SEO.
 * No implica que se atienda en estas ciudades ni que existan landings para ellas.
 */
export const ciudadesFormulario: CiudadFormulario[] = [
  { valor: "mallorca", label: "Mallorca" },
  { valor: "barcelona", label: "Barcelona" },
  { valor: "madrid", label: "Madrid" },
  { valor: "almeria", label: "Almería" },
  { valor: "murcia", label: "Murcia" },
  { valor: "tenerife", label: "Tenerife" },
];

export const leadFormConfig: LeadFormConfig = {
  endpoint: import.meta.env.PUBLIC_LEADS_ENABLED === 'true' ? '/api/lead/' : undefined,
  thanksPath: '/gracias/',
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || undefined,
};

export const isLeadFormOperational = (
  config: LeadFormConfig = leadFormConfig,
): boolean => Boolean(config.endpoint);
