/**
 * Validación de los datos que envía el formulario (Fase 2).
 *
 * Solo valida forma y longitudes. La coherencia con el contenido del
 * repositorio (landing existente y publicable, interés permitido para ese
 * tratamiento) se comprueba en handleLead con datos de confianza.
 */
import { z } from 'astro/zod';
import { ciudadesFormulario } from '../../components/forms/formConfig';

const CIUDADES = new Set(ciudadesFormulario.map((c) => c.valor));

/** Texto opcional: vacío o solo espacios se trata como ausente. */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Normalización tolerante del teléfono (pacientes nacionales e internacionales):
 * quita espacios y separadores, `00` → `+`, y añade +34 a los números
 * españoles de 9 cifras. Devuelve undefined si no parece un teléfono.
 */
export function normalizarTelefono(raw: string): string | undefined {
  let v = raw.trim().replace(/[\s.\-()/]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (!/^\+?\d+$/.test(v)) return undefined;
  if (!v.startsWith('+') && /^[6789]\d{8}$/.test(v)) v = `+34${v}`;
  const digitos = v.replace('+', '').length;
  if (digitos < 6 || digitos > 15) return undefined;
  return v;
}

export const leadInputSchema = z.object({
  submission_id: z.uuid({ message: 'Identificador de envío no válido.' }),
  landing_id: z.string().trim().min(1).max(120),
  nombre: z
    .string({ message: 'Indica tu nombre.' })
    .trim()
    .min(1, { message: 'Indica tu nombre.' })
    .max(120, { message: 'El nombre es demasiado largo.' }),
  telefono: z
    .string({ message: 'Indica tu teléfono.' })
    .max(40, { message: 'Revisa el teléfono.' })
    .transform((v, ctx) => {
      const tel = normalizarTelefono(v);
      if (!tel) {
        ctx.addIssue({ code: 'custom', message: v.trim() ? 'Revisa el teléfono.' : 'Indica tu teléfono.' });
        return z.NEVER;
      }
      return tel;
    }),
  email: z
    .string()
    .trim()
    .max(254, { message: 'Revisa el email.' })
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined))
    .refine((v) => v === undefined || z.email().safeParse(v).success, { message: 'Revisa el email.' }),
  ciudad: z
    .string({ message: 'Elige tu ciudad.' })
    .refine((v) => CIUDADES.has(v), { message: 'Elige tu ciudad.' }),
  interes: opcional(60),
  consentimiento: z.literal(true, { message: 'Debes aceptar la política de privacidad.' }),
  page_url: opcional(2000),
  utm_source: opcional(200),
  utm_medium: opcional(200),
  utm_campaign: opcional(200),
  utm_term: opcional(200),
  utm_content: opcional(200),
  gclid: opcional(300),
  fbclid: opcional(300),
  turnstile_token: opcional(2048),
  /** Honeypot: campo oculto que una persona nunca rellena. */
  website: z.string().max(500).optional(),
});

export type LeadInput = z.output<typeof leadInputSchema>;

/** Campos que se muestran al usuario como errores de formulario. */
export const CAMPOS_VISIBLES = ['nombre', 'telefono', 'email', 'ciudad', 'interes', 'consentimiento'] as const;
export type CampoVisible = (typeof CAMPOS_VISIBLES)[number];

/** Errores por campo visible (primer mensaje de cada uno). */
export function erroresPorCampo(error: z.ZodError): Partial<Record<CampoVisible, string>> {
  const out: Partial<Record<CampoVisible, string>> = {};
  for (const issue of error.issues) {
    const campo = issue.path[0];
    if (typeof campo === 'string' && (CAMPOS_VISIBLES as readonly string[]).includes(campo)) {
      out[campo as CampoVisible] ??= issue.message;
    }
  }
  return out;
}
