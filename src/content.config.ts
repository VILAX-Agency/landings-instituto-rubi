/**
 * Modelo de contenidos (CLAUDE.md §5).
 *
 *  - organizacion: datos de la clínica compartidos por todas las landings
 *    (contacto, barra de confianza, equipo, pie legal, textos del formulario).
 *  - tratamientos: contenido clínico compartido de cada tratamiento
 *    (ventajas, comparativa, casos, recuperación, FAQs...).
 *  - localidades: datos de sede/localidad confirmados.
 *  - landings: lo propio de cada página (h1, SEO, intro, imagen, secciones,
 *    estado). Los nombres de campo siguen las columnas del Excel de SEO
 *    (ver docs/importador.md) para que el importador sea un mapeo directo.
 *
 * Una landing REFERENCIA tratamiento y localidad; no duplica su contenido.
 */
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/* ---------- Tipos compartidos ---------- */

/** Texto con variante opcional para móvil. `movil: ""` oculta el texto en móvil. */
const textoResponsive = z.union([
  z.string().min(1),
  z.object({ desktop: z.string().min(1), movil: z.string() }),
]);

const ICONOS = [
  'shield',
  'card',
  'video',
  'pin',
  'ruler',
  'drop',
  'clock',
  'heart',
] as const;
const icono = z.enum(ICONOS);

const SECCIONES = [
  'hero',
  'confianza',
  'antes_despues',
  'tecnica',
  'simulacion',
  'recuperacion',
  'testimonios',
  'equipo',
  'faq',
  'cta_final',
] as const;

export const ESTADOS = ['borrador', 'pendiente_revision', 'aprobado'] as const;

const urlOpcional = z.url().optional();

/* ---------- organizacion ---------- */

const organizacion = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/organizacion' }),
  schema: ({ image }) =>
    z.object({
      nombre: z.string(),
      telefono: z.object({
        display: z.string(),
        /** Formato E.164 sin espacios, p. ej. +34936776451 */
        e164: z.string().regex(/^\+\d{8,15}$/),
      }),
      /** Enlace wa.me de WhatsApp; los botones se pintan inactivos si falta. */
      whatsapp_url: urlOpcional,
      google_reviews_url: urlOpcional,
      prueba_social: z.object({
        nota_google: z.string(),
        numero_resenas: z.string(),
        cirugias: z.string(),
        financiacion: z.string(),
      }),
      confianza: z
        .array(z.object({ icono, texto: textoResponsive }))
        .min(1)
        .max(4),
      formulario: z.object({
        titulo: z.string(),
        subtitulo: z.string(),
        etiqueta_interes: z.string(),
        consentimiento: z.string(),
        cta_label: z.string(),
        nota: z.string(),
      }),
      equipo: z.object({
        eyebrow: z.string(),
        /** El título lo aporta cada tratamiento (secciones.equipo.titulo). */
        director: z.object({ nombre: z.string(), cargo: textoResponsive }),
        imagen: image(),
        imagen_alt: z.string(),
        credenciales: z.array(z.object({ texto: z.string(), ocultar_movil: z.boolean().default(false) })),
        avatares: z.array(z.object({ imagen: image(), alt: z.string() })).max(4),
        equipo_extra: z.string(),
        equipo_texto: textoResponsive,
        sede: z.object({
          imagen: image(),
          imagen_alt: z.string(),
          texto: z.string(),
          detalle: z.string(),
        }),
      }),
      footer: z.object({
        enlaces: textoResponsive,
        aviso: textoResponsive,
      }),
    }),
});

/* ---------- tratamientos ---------- */

const tratamientos = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/tratamientos' }),
  schema: ({ image }) =>
    z.object({
      nombre: z.string(),
      /** Contenido ficticio de pruebas: nunca publicable. */
      fixture: z.boolean().default(false),
      /** Opciones del bloque "¿Qué te interesa?" del formulario. */
      interes_opciones: z
        .array(z.object({ valor: z.string(), label: z.string(), label_movil: z.string().optional() }))
        .min(1),
      secciones: z.object({
        antes_despues: z
          .object({
            eyebrow: z.string(),
            titulo: z.string(),
            intro: textoResponsive,
            cta_label: z.string(),
            casos: z
              .array(
                z.object({
                  imagen: image(),
                  alt: z.string(),
                  titulo: z.string(),
                  detalle: z.string(),
                }),
              )
              .min(1),
            aviso: z.string(),
          })
          .optional(),
        tecnica: z
          .object({
            eyebrow: z.string(),
            titulo: z.string(),
            intro: textoResponsive,
            ventajas: z
              .array(z.object({ icono, titulo: z.string(), texto: z.string() }))
              .min(1)
              .max(4),
            comparativa: z
              .object({
                columna_propia: textoResponsive,
                columna_alternativa: textoResponsive,
                filas: z
                  .array(
                    z.object({
                      concepto: textoResponsive,
                      propia: textoResponsive,
                      alternativa: textoResponsive,
                    }),
                  )
                  .min(1),
              })
              .optional(),
          })
          .optional(),
        simulacion: z
          .object({
            eyebrow: z.string(),
            titulo: z.string(),
            intro: textoResponsive,
            imagen: image(),
            imagen_alt: z.string(),
            etiqueta: z.string(),
            video_url: urlOpcional,
            pasos: z.array(z.object({ titulo: z.string(), texto: z.string() })).min(1),
            cta_label: z.string(),
          })
          .optional(),
        recuperacion: z
          .object({
            eyebrow: z.string(),
            titulo: z.string(),
            intro: textoResponsive.optional(),
            pasos: z.array(z.object({ titulo: z.string(), texto: z.string() })).min(1).max(4),
          })
          .optional(),
        testimonios: z
          .object({
            eyebrow: z.string(),
            titulo: z.string(),
            video: z.object({
              imagen: image(),
              alt: z.string(),
              nombre: z.string(),
              detalle: z.string(),
              video_url: urlOpcional,
            }),
            resenas: z
              .array(
                z.object({
                  cita: z.string(),
                  autor: z.string(),
                  ocultar_movil: z.boolean().default(false),
                }),
              )
              .min(1),
          })
          .optional(),
        faq: z
          .object({
            eyebrow: z.string(),
            titulo: z.string(),
            intro: z.string(),
            cta_label: z.string(),
            preguntas: z.array(z.object({ pregunta: z.string(), respuesta: z.string() })).min(1),
          })
          .optional(),
        /** Textos del bloque de equipo propios del tratamiento (el resto viene de organización). */
        equipo: z
          .object({
            eyebrow: z.string().optional(),
            titulo: z.string(),
          })
          .optional(),
        cta_final: z.object({
          eyebrow: z.string(),
          titulo: z.string(),
          intro: z.string(),
          puntos: z.array(z.string()),
        }),
      }),
    }),
});

/* ---------- localidades ---------- */

const localidades = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/localidades' }),
  schema: z.object({
    nombre: z.string(),
    fixture: z.boolean().default(false),
    /** Referencia verificable de los datos locales (CLAUDE.md §6). */
    datos_locales_fuente: z.string(),
    telefono: z
      .object({ display: z.string(), e164: z.string().regex(/^\+\d{8,15}$/) })
      .optional(),
    whatsapp_url: urlOpcional,
    /** Sustituye la tarjeta de sedes del bloque de equipo. */
    sede: z.object({ texto: z.string(), detalle: z.string() }).optional(),
  }),
});

/* ---------- landings ---------- */

const overrideSeccion = z.object({
  tipo: z.enum(SECCIONES),
  eyebrow: z.string().optional(),
  titulo: z.string().optional(),
  intro: textoResponsive.optional(),
});

const landings = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/landings' }),
  schema: ({ image }) =>
    z.object({
      tratamiento_slug: reference('tratamientos'),
      localidad_slug: reference('localidades').optional(),
      estado: z.enum(ESTADOS),
      fixture: z.boolean().default(false),
      seo_title: z.string().min(10).max(70),
      meta_description: z.string().min(50).max(170),
      eyebrow: z.string(),
      h1: z.string().min(5),
      intro: z.string(),
      imagen_principal: image().optional(),
      imagen_principal_alt: z.string().optional(),
      /** Opción preseleccionada en "¿Qué te interesa?". */
      interes_preseleccionado: z.string().optional(),
      /** Orden y selección de bloques. Permite omitir/reordenar sin tocar componentes. */
      secciones: z.array(overrideSeccion).min(1),
      /** Notas editoriales internas (no se renderizan). */
      notas_revision: z.array(z.string()).default([]),
    }),
});

export const collections = { organizacion, tratamientos, localidades, landings };
