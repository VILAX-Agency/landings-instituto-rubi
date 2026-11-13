// Comprobación posterior al build (Fase 2). Uso: npm run check:dist
//
// 1. Cada página HTML lleva <meta name="robots" content="noindex, ...">.
// 2. En modo publicación (PUBLIC_INCLUDE_DRAFTS=false): no hay índice de
//    previsualización ni landings en borrador/ficticias (aviso de previsualización).
// 3. Los VALORES reales de los secretos de servidor no aparecen en la salida
//    pública (.vercel/output/static) ni incrustados en el bundle de funciones.
//    Nunca se imprimen los valores, solo el nombre de la variable.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadEnv } from 'vite';

const ROOT = process.cwd();
const OUT = join(ROOT, '.vercel/output');
const STATIC = join(OUT, 'static');
const FUNCTIONS = join(OUT, 'functions');
const SECRET_NAMES = [
  'SUPABASE_SECRET_KEY',
  'RESEND_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'CRON_SECRET',
  'SUPABASE_TEST_SECRET_KEY',
  'RESEND_TEST_API_KEY',
];
const MIN_SECRET_LENGTH = 8;

const env = { ...loadEnv('production', ROOT, ''), ...process.env };
const errors = [];

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) out = out.concat(walk(path));
    else out.push(path);
  }
  return out;
}

let files;
try {
  files = walk(STATIC);
} catch {
  console.error('No existe .vercel/output/static: ejecuta antes "npm run build".');
  process.exit(1);
}

// 1. noindex en todas las páginas HTML
const html = files.filter((f) => f.endsWith('.html'));
for (const file of html) {
  const content = readFileSync(file, 'utf8');
  const robots = content.match(/<meta[^>]+name=["']robots["'][^>]*>/i)?.[0] ?? '';
  if (!/content=["'][^"']*noindex/i.test(robots)) errors.push(`Falta noindex: ${relative(STATIC, file)}`);
}

// 2. Modo publicación
const publication = env.PUBLIC_INCLUDE_DRAFTS === 'false';
if (publication) {
  if (html.some((f) => relative(STATIC, f) === 'index.html')) {
    errors.push('El índice de previsualización (/index.html) no debe existir en publicación.');
  }
  for (const file of html) {
    if (readFileSync(file, 'utf8').includes('preview-banner')) {
      errors.push(`Landing no aprobada o ficticia en publicación: ${relative(STATIC, file)}`);
    }
  }
}

// 3. Secretos: búsqueda de los valores exactos
const secrets = SECRET_NAMES.map((name) => [name, (env[name] ?? '').trim()]).filter(
  ([, value]) => value.length >= MIN_SECRET_LENGTH,
);
let functionFiles = [];
try {
  functionFiles = walk(FUNCTIONS);
} catch {
  /* sin funciones */
}
const targets = [
  ['salida pública', files],
  ['bundle de funciones', functionFiles.filter((f) => !f.includes('node_modules'))],
];
for (const [label, list] of targets) {
  for (const file of list) {
    const buffer = readFileSync(file);
    for (const [name, value] of secrets) {
      if (buffer.includes(value)) errors.push(`El valor de ${name} aparece en ${label}: ${relative(OUT, file)}`);
    }
  }
}

console.log(
  `check-dist: ${html.length} páginas HTML · modo ${publication ? 'publicación' : 'previsualización'} · ` +
    `${secrets.length} secretos comprobados en ${files.length + functionFiles.length} ficheros`,
);
if (errors.length) {
  console.error(errors.map((e) => `  ✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log('  ✓ sin incidencias');
