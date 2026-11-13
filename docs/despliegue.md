# Despliegue y operación (Fase 2)

Guía para poner en marcha las landings de anuncios en **Vercel Pro** con formularios operativos
(Supabase Free + Resend + Cloudflare Turnstile). Plan aprobado: [fase-2-plan.md](fase-2-plan.md).

> **Nada de esta guía se ejecuta sin aprobación**: los cambios de DNS, la conexión de servicios de
> producción y el despliegue a producción requieren el visto bueno explícito del responsable del proyecto.
> Antes de producción deben estar resueltas las decisiones pendientes (sección E del plan).

## 1. Arquitectura

```text
Anuncio → https://tratamiento.institutorubi.com/{tratamiento}/{localidad}/   (HTML estático, noindex)
             │  formulario (JS + Turnstile)
             ▼
          POST /api/lead/  (función Vercel, fra1)
             ├─ INSERT en Supabase (public.leads, UE)   ← fuente de verdad
             └─ email por Resend → buzón de leads
          GET /api/cron/notificaciones/  (Vercel Cron, cada hora)
             └─ reintenta notificaciones pendientes/fallidas (reclamación atómica)
```

- Páginas: prerenderizadas. Solo `src/pages/api/` se ejecuta en servidor.
- En producción `/` devuelve **404** (el índice de previsualización solo existe en Preview).
- Todas las páginas HTML: `<meta name="robots" content="noindex, nofollow">` + cabecera `X-Robots-Tag`.
  `robots.txt` no bloquea el rastreo (Google/AdsBot deben ver el `noindex`).

## 2. Supabase (Free, región UE)

1. Dos proyectos dentro de la cuenta de la organización (el plan Free permite dos activos):
   **producción** y **desarrollo**, ambos en una región de la UE (p. ej. `eu-central-1`, Fráncfort).
2. Activar MFA en las cuentas con acceso al panel. Limitar el acceso a las personas imprescindibles.
3. Aplicar la migración `supabase/migrations/0001_leads.sql`, **primero en desarrollo**:
   - Panel → SQL Editor → pegar y ejecutar el fichero, o
   - CLI: `supabase link --project-ref <ref>` y `supabase db push`.
4. Claves (Panel → Project Settings → API Keys):
   - `SUPABASE_URL`: URL del proyecto.
   - `SUPABASE_SECRET_KEY`: clave **secreta** (`sb_secret_…`). Salta RLS: solo en variables de servidor.
     Si el proyecto solo tiene la clave heredada `service_role` (JWT), el código la admite igualmente.
   - La clave publicable no se usa en este proyecto.
5. Comprobar la seguridad con la clave publicable (debe devolver una lista vacía o un error):
   `curl -s "$SUPABASE_URL/rest/v1/leads?select=id&limit=1" -H "apikey: <clave publicable>"`.
6. El proyecto Free se pausa tras 7 días sin actividad en la base de datos. El cron horario lee la
   base de datos y lo mantiene activo; si el cron se desactiva, revisar el estado del proyecto.

### Rotación de claves

1. Crear una nueva clave secreta en el panel.
2. Actualizarla en Vercel (`SUPABASE_SECRET_KEY`, entorno correspondiente) y volver a desplegar.
3. Verificar un envío de prueba y revocar la clave anterior.

Hacerlo también ante cualquier sospecha de filtración o cuando alguien con acceso deje el proyecto.

## 3. Resend (Free)

1. Añadir el dominio de envío y elegir la **región UE** al crearlo. Recomendado un subdominio dedicado
   (p. ej. `notificaciones.institutorubi.com`) para aislar la reputación del dominio principal.
2. Resend muestra los registros **SPF, DKIM y (recomendado) DMARC**: hay que crearlos en el DNS de IONOS
   (requiere aprobación) y esperar a que el dominio figure como verificado.
3. Variables:
   - `RESEND_API_KEY`: clave con permiso solo de envío (*sending access*), limitada a ese dominio.
   - `LEADS_EMAIL_FROM`: p. ej. `Instituto Rubí <leads@notificaciones.institutorubi.com>`.
   - `LEADS_EMAIL_TO`: **un único buzón compartido** (o alias). El plan Free permite 100 emails/día y
     3.000/mes, y **cada destinatario cuenta**.
4. Cada email lleva `Idempotency-Key: lead/{submission_id}`: Resend no reenvía el mismo lead durante 24 h.

## 4. Cloudflare Turnstile

1. En la cuenta de Cloudflare de la organización: Turnstile → Add widget.
   Hostname: `tratamiento.institutorubi.com`. Modo: *Managed*.
2. Variables: `PUBLIC_TURNSTILE_SITE_KEY` (pública) y `TURNSTILE_SECRET_KEY` (servidor).
3. En **Preview y desarrollo** se usan las claves de prueba de Cloudflare (los hostnames de Preview cambian):
   - sitekey `1x00000000000000000000AA`, secreto `1x0000000000000000000000000000000AA` (siempre pasan).
4. Fuera de `astro dev`, si falta `TURNSTILE_SECRET_KEY` el endpoint **rechaza** los envíos (falla cerrado).

## 5. Vercel Pro

### Proyecto

1. Importar el repositorio de GitHub (framework detectado: Astro). Node.js 22.
2. Rama de producción: `main`. Cada PR genera un despliegue Preview.
3. **Deployment Protection** activado para los Preview (Vercel Authentication). Vercel ya añade
   `X-Robots-Tag: noindex` a los Preview.
4. Región de funciones: `fra1` (definida en `vercel.json`). Comprobar en Settings → Functions que
   aparece Frankfurt y, si no, fijarla ahí.

### Variables de entorno

| Variable | Production | Preview |
|---|---|---|
| `PUBLIC_SITE_URL` | `https://tratamiento.institutorubi.com` | igual |
| `PUBLIC_LANDINGS_BASE` | vacío | vacío |
| `PUBLIC_INCLUDE_DRAFTS` | `false` | `true` |
| `PUBLIC_INCLUDE_FIXTURES` | `false` | `true` |
| `PUBLIC_LEADS_ENABLED` | `true` (cuando se apruebe) | `true` |
| `PUBLIC_TURNSTILE_SITE_KEY` | clave real | clave de prueba |
| `TURNSTILE_SECRET_KEY` | secreto real | secreto de prueba |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | proyecto de **producción** | proyecto de **desarrollo** |
| `RESEND_API_KEY` / `LEADS_EMAIL_FROM` | reales | reales o vacías* |
| `LEADS_EMAIL_TO` | buzón de leads | buzón de pruebas |
| `CRON_SECRET` | cadena aleatoria (≥ 32 caracteres) | — |

\* Sin Resend configurado, los leads se guardan con notificación `failed` (útil para probar en Preview).

Las claves de producción **solo** deben existir en el entorno Production.

### Cron de reintentos

- Definido en `vercel.json` (`0 * * * *` → `/api/cron/notificaciones/`). Vercel envía
  `Authorization: Bearer $CRON_SECRET` si la variable `CRON_SECRET` existe.
- Los crons solo se ejecutan en el despliegue de **producción**. Comprobar en Settings → Cron Jobs
  que aparece tras el primer despliegue.

### Protección contra abuso (WAF)

Firewall → Rules → nueva regla de **Rate limit**: ruta `/api/lead/`, método `POST`, p. ej.
**10 peticiones por IP cada 10 minutos** → `429`. Coste por uso (≈ 0,50 $ por millón de peticiones permitidas).

### Dominio

1. Settings → Domains → añadir `tratamiento.institutorubi.com`.
2. En IONOS, crear el registro **CNAME** `tratamiento` con el valor que indique Vercel (requiere aprobación).
   No afecta al WordPress ni al correo del dominio principal.
3. Esperar a la verificación y al certificado HTTPS.

## 6. Comprobaciones antes y después de desplegar

En local, antes de abrir o fusionar un PR:

```sh
npm run check            # tipos + contenidos
npm test                 # pruebas unitarias (integración si hay SUPABASE_TEST_*)
npm run build && npm run check:dist
PUBLIC_INCLUDE_DRAFTS=false PUBLIC_INCLUDE_FIXTURES=false npm run build && \
  PUBLIC_INCLUDE_DRAFTS=false npm run check:dist     # modo publicación
```

En el despliegue (Preview o producción):

```sh
D=https://tratamiento.institutorubi.com
curl -sI $D/                       # producción: 404
curl -sI $D/aumento-pecho/         # 200 + X-Robots-Tag: noindex, nofollow
curl -sI $D/_astro/<fichero>       # 200 sin X-Robots-Tag, cache inmutable
curl -s -X POST $D/api/lead/ -H 'content-type: application/json' -d '{}'   # 403 (Turnstile)
curl -s $D/api/cron/notificaciones/                                       # 401
```

Prueba manual (checklist):

- [ ] Enviar un lead real de prueba desde móvil y desde escritorio → página `/gracias/`.
- [ ] La fila aparece en Supabase con `notification_status = sent`.
- [ ] Llega el email al buzón de leads con los datos mínimos.
- [ ] Fallo simulado de email (p. ej. `LEADS_EMAIL_TO` inválido en Preview) → fila `failed`; tras corregirlo,
      el cron la pasa a `sent`.
- [ ] Teclado: se puede completar y enviar el formulario; los errores se anuncian.
- [ ] Sin JavaScript: botón deshabilitado y teléfono visible.
- [ ] HTTPS y dominio correctos; diseño de las landings sin cambios.

## 7. Operación

Leads cuya notificación se agotó (5 intentos) — revisar a mano y contactar:

```sql
select submission_id, created_at, notification_error
  from public.leads
 where notification_status = 'failed' and notification_attempts >= 5
 order by created_at desc;
```

Para volver a intentarlo tras corregir la causa: `update public.leads set notification_attempts = 0
where submission_id = '<id>';` (el cron lo recogerá en la siguiente hora).

Los logs de Vercel solo contienen el `submission_id`, nunca datos personales.

## 8. Copias de seguridad y recuperación (Supabase Free)

Supabase Free **no incluye copias automáticas** ni SLA.

**Procedimiento** (manual, semanal y antes de cualquier migración):

1. Exportar la tabla:
   `supabase db dump --db-url "$DB_URL" --data-only -t public.leads -f leads-AAAAMMDD.sql`
   (o Table Editor → Export to CSV).
2. Cifrar de inmediato con la clave pública del cliente y borrar el fichero sin cifrar:
   `age -r <clave_publica> -o leads-AAAAMMDD.sql.age leads-AAAAMMDD.sql && rm leads-AAAAMMDD.sql`
   (o GPG). Nunca guardar exportaciones sin cifrar ni subirlas al repositorio.
3. Guardarlo en el almacenamiento con control de acceso del cliente (con MFA).
4. Conservar las copias solo durante el plazo de conservación aprobado y eliminar las anteriores.

**Restauración:**

1. Descifrar: `age -d -i clave.txt leads-AAAAMMDD.sql.age > leads.sql`.
2. Restaurar primero en el proyecto de **desarrollo** y verificar los datos.
3. En producción, cargar en una tabla temporal y fusionar sin duplicar:
   `insert into public.leads select * from tmp_leads on conflict (submission_id) do nothing;`
4. Borrar los ficheros descifrados.

**Riesgo aceptado:** se pueden perder los leads creados desde la última copia si Supabase pierde datos.
El buzón de notificaciones conserva una copia de los datos de contacto de cada lead, lo que lo mitiga en parte.

## 9. Riesgos residuales

- Entrega de emails **al menos una vez**: un duplicado solo es posible si el registro del estado falla
  durante más de 24 h (caducidad de la clave de idempotencia de Resend).
- Abuso del formulario: limitado por Turnstile, honeypot y la regla de rate limit del WAF; no hay
  limitador propio en base de datos.
- Sin JavaScript no se puede enviar el formulario (se muestra el teléfono).
- Visitar `/gracias/` no prueba una conversión; la fuente de verdad es la tabla `leads`.
