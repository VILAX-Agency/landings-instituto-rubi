# Importador Excel/Word → landings (preparación, Fase 1)

El importador **todavía no está implementado**. Este documento fija cómo encajará con el
modelo de datos actual para que, cuando se construya, sea un mapeo directo y determinista
(CLAUDE.md §6). El esquema no es definitivo hasta validar el primer Excel real con SEO.

## Salida esperada

El importador **no genera HTML**. Escribe un JSON por landing en
`src/content/landings/{id}.json`, validado por el esquema Zod de `src/content.config.ts`.
Astro genera las páginas con la plantilla única (`src/components/LandingPage.astro`).

## Mapeo de columnas (Excel índice → JSON de landing)

| Columna Excel | Campo JSON | Notas |
|---|---|---|
| `id` | nombre del fichero (`{id}.json`) | Estable: las reimportaciones actualizan el mismo fichero. |
| `tratamiento_slug` | `tratamiento_slug` | Debe existir en `src/content/tratamientos/`. Referencia validada por Astro. |
| `localidad_slug` | `localidad_slug` | Vacío = landing general. Debe existir en `src/content/localidades/`. |
| `url_destino` | — (validación) | La URL se **calcula** con `buildLandingPath()`; el importador solo comprueba que coincide y avisa si no. |
| `h1` | `h1` | |
| `seo_title` | `seo_title` | 10–70 caracteres. |
| `meta_description` | `meta_description` | 50–170 caracteres. |
| `intro` | `intro` | O referencia a sección del `.docx`. |
| `documento_fuente` | — | Ruta al `.docx`; su contenido se asocia por referencia explícita, nunca por parecido de nombre. |
| `imagen_principal` | `imagen_principal` | Ruta relativa a un recurso autorizado en `src/assets/`. |
| `datos_locales_fuente` | `localidades/*.json → datos_locales_fuente` | Obligatorio en cada localidad. |
| `estado` | `estado` | `borrador` · `pendiente_revision` · `aprobado`. Las nuevas entran como `borrador`. |

Campos sin columna todavía (valores por defecto que aplicaría el importador):
`eyebrow`, `imagen_principal_alt`, `interes_preseleccionado`, `secciones` (orden de bloques)
y `fixture` (`false`). Conviene acordar con SEO si se añaden como columnas.

## Validaciones que ya hace el build

- Esquema Zod de las cuatro colecciones (tipos, longitudes, enumerados, imágenes existentes).
- Referencias a tratamiento/localidad existentes.
- Secciones pedidas por la landing que el tratamiento no define → error.
- URLs duplicadas → error.
- Datos ficticios (`fixture`) usados en una landing no marcada como ficticia → error.
- Prefijo de URL inválido (`PUBLIC_LANDINGS_BASE`) → error.

## Pendiente para el importador (fase posterior)

1. Lectura de `.xlsx/.csv` y `.docx` sin modificar los originales.
2. `--dry-run` por defecto con informe: creados, modificados, omitidos, errores, avisos SEO/médicos.
3. Idempotencia por `id` y detección de cambios manuales posteriores (no sobrescribir sin aviso).
4. Normalización de slugs y detección de filas/URLs duplicadas antes de escribir.
