-- Fase 2 · Leads de las landings de anuncios.
-- Aplicar primero en el proyecto de DESARROLLO; en producción solo con aprobación.
--
-- Seguridad: RLS activado SIN políticas y sin privilegios para anon/authenticated.
-- Solo el servidor (clave secreta, rol service_role) lee y escribe.

create table public.leads (
  id                       uuid primary key default gen_random_uuid(),
  submission_id            uuid not null unique,
  created_at               timestamptz not null default now(),

  landing_id               text not null check (char_length(landing_id) between 1 and 120),
  tratamiento              text not null check (char_length(tratamiento) between 1 and 120),
  localidad                text check (char_length(localidad) <= 120),

  nombre                   text not null check (char_length(nombre) between 1 and 120),
  telefono                 text not null check (char_length(telefono) between 6 and 20),
  email                    text check (char_length(email) <= 254),
  ciudad                   text not null check (char_length(ciudad) between 1 and 60),
  interes                  text check (char_length(interes) <= 60),

  privacy_notice_version   text not null check (char_length(privacy_notice_version) between 1 and 40),
  privacy_acknowledged_at  timestamptz not null,

  page_url                 text check (char_length(page_url) <= 2000),
  utm_source               text check (char_length(utm_source) <= 200),
  utm_medium               text check (char_length(utm_medium) <= 200),
  utm_campaign             text check (char_length(utm_campaign) <= 200),
  utm_term                 text check (char_length(utm_term) <= 200),
  utm_content              text check (char_length(utm_content) <= 200),
  gclid                    text check (char_length(gclid) <= 300),
  fbclid                   text check (char_length(fbclid) <= 300),

  notification_status      text not null default 'pending'
                           check (notification_status in ('pending', 'sent', 'failed')),
  notification_attempts    integer not null default 0 check (notification_attempts >= 0),
  notification_claimed_at  timestamptz,
  notified_at              timestamptz,
  notification_error       text check (char_length(notification_error) <= 500)
);

comment on table public.leads is
  'Leads de las landings de anuncios (Fase 2). Datos personales: acceso solo desde el servidor.';
comment on column public.leads.localidad is 'Localidad de la landing (contenido del repositorio).';
comment on column public.leads.ciudad is 'Ciudad elegida por el usuario en el formulario.';
comment on column public.leads.notification_claimed_at is
  'Reclamación atómica del envío de la notificación; caduca a los 15 minutos.';

create index leads_notification_idx on public.leads (notification_status, created_at);

alter table public.leads enable row level security;
revoke all on table public.leads from anon, authenticated;

-- Reclamación atómica de notificaciones pendientes o fallidas.
-- Solo quien recibe una fila la envía: FOR UPDATE SKIP LOCKED impide que dos
-- ejecuciones concurrentes reclamen el mismo lead. Una reclamación de más de
-- 15 minutos (función caída) vuelve a ser reintentable.
create or replace function public.claim_retryable_notifications(max_rows integer default 20)
returns setof public.leads
language sql
security invoker
set search_path = ''
as $$
  update public.leads
     set notification_claimed_at = now(),
         notification_attempts   = notification_attempts + 1
   where id in (
     select id
       from public.leads
      where notification_status in ('pending', 'failed')
        and notification_attempts < 5
        and (notification_claimed_at is null
             or notification_claimed_at < now() - interval '15 minutes')
      order by created_at
      limit greatest(1, least(max_rows, 100))
      for update skip locked
   )
  returning *;
$$;

revoke all on function public.claim_retryable_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_retryable_notifications(integer) to service_role;
