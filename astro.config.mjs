// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

// Salida estática: todas las landings se prerenderizan. Solo las rutas de
// src/pages/api/ (prerender = false) se ejecutan como funciones en Vercel.
// Los canonicals usan SITE_URL de src/config/site.ts (variable PUBLIC_SITE_URL);
// `site` solo es el valor por defecto de Astro.
const secret = () => envField.string({ context: 'server', access: 'secret', optional: true });

export default defineConfig({
  site: 'https://tratamiento.institutorubi.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
  adapter: vercel(),
  env: {
    // Secretos solo de servidor: Astro impide importarlos desde código de cliente.
    // Son opcionales para que el build funcione sin ellos; el endpoint los exige en ejecución.
    schema: {
      SUPABASE_URL: secret(),
      SUPABASE_SECRET_KEY: secret(),
      RESEND_API_KEY: secret(),
      LEADS_EMAIL_FROM: secret(),
      LEADS_EMAIL_TO: secret(),
      TURNSTILE_SECRET_KEY: secret(),
      CRON_SECRET: secret(),
    },
  },
});
