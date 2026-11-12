# Instituto Rubí · Sistema de landings (Astro)

Fase 1: maquetación de landings a partir de Figma con plantilla y datos separados.
La captación de leads (formularios operativos) es **Fase 2** y no está implementada.
Reglas del proyecto: [CLAUDE.md](CLAUDE.md).

## Uso

```sh
npm install
npm run dev      # http://localhost:4321  (índice de previsualización en /)
npm run check    # tipos + validación de contenidos
npm run build    # salida estática en dist/
```

Variables (ver `.env.example`):

| Variable | Por defecto | Uso |
|---|---|---|
| `PUBLIC_LANDINGS_BASE` | `tratamientos` | Prefijo de URL (`campanas`, vacío = raíz…). Aún sin decidir. |
| `PUBLIC_INCLUDE_DRAFTS` | `true` | `false` en un build de publicación: excluye no aprobadas. |
| `PUBLIC_INCLUDE_FIXTURES` | `true` | `false` en publicación: excluye landings ficticias. |

Todas las landings llevan `noindex, nofollow` y no hay sitemap.

## Estructura

```
src/config/site.ts            URLs (buildLandingPath), flags de build, robots
src/content.config.ts         esquema Zod: organizacion, tratamientos, localidades, landings
src/content/                  datos (JSON)
src/components/LandingPage.astro   plantilla única: compone secciones según landing.secciones
src/components/sections/      bloques (Hero, TrustBar, BeforeAfter, Technique, …)
src/components/ui/            Button, IconButton, IconRing, Icon, SectionHeading, …
src/components/forms/         LeadForm (no operativo) + formConfig.ts (enganche Fase 2)
src/styles/                   tokens.css (variables Figma), typography.css, global.css
src/assets/                   imágenes e iconos exportados de Figma
docs/importador.md            mapeo Excel → JSON para el futuro importador
```

## Añadir una landing

1. (Si no existe) crear el tratamiento en `src/content/tratamientos/{slug}.json`.
2. (Si aplica) crear la localidad en `src/content/localidades/{slug}.json` con `datos_locales_fuente`.
3. Crear `src/content/landings/{id}.json` con `estado: "borrador"` y la lista `secciones`.
4. `npm run check && npm run build`.

No hace falta tocar componentes ni CSS. Ejemplo de prueba: `rinoplastia-ciudad-demo.json`
(ficticio, marcado `fixture: true`, nunca publicable).

## Figma

Archivo `YYKaY6jHALGyBFYace3xn7` · Desktop `22:132` · Mobile `10:2` · Barra fija `24:599` ·
Componentes en la página `Componentes` (`17:2`).
