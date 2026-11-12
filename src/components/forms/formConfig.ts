/**
 * Punto de enganche para la captación de leads (FASE 2 — pendiente).
 *
 * En Fase 1 los formularios son solo maquetación: no hay endpoint, no se
 * envían ni almacenan datos y no se simula ningún mensaje de éxito.
 * Mientras `endpoint` sea `undefined`, LeadForm:
 *   - no tiene atributo `action`,
 *   - bloquea el envío (botón deshabilitado + preventDefault),
 *   - muestra el aviso "Formulario no operativo".
 *
 * Fase 2: definir aquí el proveedor/endpoint aprobado y el contrato de datos
 * (`LeadPayload`). No conectar servicios sin aprobación expresa.
 */

export interface LeadFormConfig {
  /** URL del sistema de captación. Fase 1: siempre undefined. */
  endpoint?: string;
  /** Identificador del proveedor elegido en Fase 2. */
  provider?: string;
}

/** Contrato previsto de los datos del formulario (para Fase 2). */
export interface LeadPayload {
  nombre: string;
  telefono: string;
  email?: string;
  ciudad: string;
  interes: string;
  consentimiento: boolean;
  landing_id: string;
  tratamiento: string;
  localidad?: string;
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
  endpoint: undefined,
  provider: undefined,
};

export const isLeadFormOperational = (
  config: LeadFormConfig = leadFormConfig,
): boolean => Boolean(config.endpoint);
