import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Pruebas de la lógica de leads (Fase 2). No cargan Astro: las dependencias
// (Supabase, Resend, Turnstile, contenido) se inyectan como funciones.
// Las pruebas de integración solo leen variables con prefijo *_TEST_
// (proyecto de DESARROLLO), nunca las de producción.
export default defineConfig(({ mode }) => ({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    env: loadEnv(mode, process.cwd(), ['SUPABASE_TEST_', 'RESEND_TEST_']),
  },
}));
