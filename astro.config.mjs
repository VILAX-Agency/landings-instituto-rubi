// @ts-check
import { defineConfig } from 'astro/config';

// Fase 1: salida estática para previsualización. No hay despliegue configurado.
// El dominio se usa solo para construir canonicals absolutos.
export default defineConfig({
  site: 'https://institutorubi.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
