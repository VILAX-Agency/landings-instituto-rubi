# Instituto Rubí · Sistema de landings (Astro)

Landings de campañas de pago (siempre `noindex`) en `tratamiento.institutorubi.com`, generadas desde
Figma con plantilla y datos separados.

- **Fase 1:** maquetación, componentes, tokens y modelo de contenidos.
- **Fase 2:** formularios operativos (Supabase + Resend + Turnstile) y despliegue en Vercel Pro.
  Plan: [docs/fase-2-plan.md](docs/fase-2-plan.md) · Despliegue y operación: [docs/despliegue.md](docs/despliegue.md).

Reglas del proyecto: [CLAUDE.md](CLAUDE.md).

## Uso

```sh
npm install
cp .env.example .env.local   # y rellenar (nunca subir a Git)
npm run dev          # http://localhost:4321  (índice de previsualización en /)
npm run check        # tipos + validación de contenidos
npm test             # pruebas (Vitest)
npm run build        # salida para Vercel en .vercel/output/
npm run check:dist   # noindex, exclusión de borradores y ausencia de secretos en el build
```

`astro preview` no está disponible con el adaptador de Vercel: usar `npm run dev` o un despliegue Preview.

Para probar el formulario en local: `PUBLIC_LEADS_ENABLED=true` y un proyecto Supabase de **desarrollo**
(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`). Sin `TURNSTILE_SECRET_KEY`, `astro dev` omite Turnstile; sin Resend,
los leads se guardan con notificación `failed`.

## Variables

Ver `.env.example` y la tabla por entorno en [docs/despliegue.md](docs/despliegue.md).

| Variable | Por defecto | Uso |
|---|---|---|
| `PUBLIC_SITE_URL` | `https://tratamiento.institutorubi.com` | Origen de los canonicals. |
| `PUBLIC_LANDINGS_BASE` | vacío | Prefijo de URL (vacío = raíz del subdominio). |
| `PUBLIC_INCLUDE_DRAFTS` | `true` | `false` en producción: excluye no aprobadas e índice. |
| `PUBLIC_INCLUDE_FIXTURES` | `true` | `false` en producción: excluye landings ficticias. |
| `PUBLIC_LEADS_ENABLED` | `false` | `true` activa el envío real del formulario. |
| `PUBLIC_TURNSTILE_SITE_KEY` | vacío | Clave pública de Turnstile. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | — | Servidor (astro:env). |
| `RESEND_API_KEY`, `LEADS_EMAIL_FROM`, `LEADS_EMAIL_TO` | — | Servidor (astro:env). |
| `TURNSTILE_SECRET_KEY`, `CRON_SECRET` | — | Servidor (astro:env). |
| `SUPABASE_TEST_URL`, `SUPABASE_TEST_SECRET_KEY` | — | Solo pruebas de integración (proyecto de desarrollo). |

## Estructura

```
src/config/site.ts            URLs (buildLandingPath, rutas reservadas), flags de build, robots
src/content.config.ts         esquema Zod: organizacion, tratamientos, localidades, landings
src/content/                  datos (JSON)
src/components/LandingPage.astro   plantilla única: compone secciones según landing.secciones
src/components/PreviewIndex.astro  índice interno (solo en builds de previsualización)
src/components/sections/      bloques (Hero, TrustBar, BeforeAfter, Technique, …)
src/components/ui/            Button, IconButton, IconRing, Icon, SectionHeading, …
src/components/forms/         LeadForm + formConfig.ts + leadFormClient.ts (envío en el navegador)
src/lib/leads/                validación, endpoint, Supabase, Resend, Turnstile y reintentos
src/pages/[...slug].astro     landings (+ índice en previsualización)
src/pages/api/                POST /api/lead/ y cron /api/cron/notificaciones/
src/pages/gracias.astro, 404.astro
src/styles/                   tokens.css (variables Figma), typography.css, global.css
src/assets/                   imágenes e iconos exportados de Figma
supabase/migrations/          esquema de la tabla leads
tests/                        Vitest (unitarias + integración opcional)
scripts/check-dist.mjs        comprobación posterior al build
vercel.json                   región fra1, X-Robots-Tag en HTML, cron
docs/                         plan de Fase 2, despliegue, importador
```

## Añadir una landing

1. (Si no existe) crear el tratamiento en `src/content/tratamientos/{slug}.json`.
2. (Si aplica) crear la localidad en `src/content/localidades/{slug}.json` con `datos_locales_fuente`.
3. Crear `src/content/landings/{id}.json` con `estado: "borrador"` y la lista `secciones`.
4. `npm run check && npm run build`.

No hace falta tocar componentes, CSS ni el formulario. Solo las landings `aprobado` (y no ficticias) se publican
en producción. Ejemplo de prueba: `rinoplastia-ciudad-demo.json` (ficticio, `fixture: true`, nunca publicable).

## Figma

Archivo `YYKaY6jHALGyBFYace3xn7` · Desktop `22:132` · Mobile `10:2` · Barra fija `24:599` ·
Componentes en la página `Componentes` (`17:2`).
