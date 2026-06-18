-- =====================================================================
--  TT · Aviso por correo al crear una tarea
--  Etapa 1 (BASE): plantilla editable + función que resuelve los correos
--  de los responsables. El ENVÍO lo hace una Edge Function (ver
--  supabase/functions/aviso-tarea) disparada por un webhook en `tareas`.
--  Pegar TODO en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- 1) PLANTILLA editable (asunto + cuerpo) ----------
-- Una sola fila (id = 1). El cuerpo admite variables {{...}} que la Edge
-- Function reemplaza por los datos reales de la tarea:
--   {{codigo}} {{tema}} {{fecha}} {{responsable}} {{creador}} {{area}}
create table if not exists public.plantilla_correo (
  id         int primary key default 1,
  asunto     text not null default 'Nueva tarea asignada: {{codigo}} — {{tema}}',
  cuerpo     text not null default
    'Hola {{responsable}}:' || chr(10) || chr(10) ||
    'Se te asignó una nueva tarea.' || chr(10) || chr(10) ||
    'Código: {{codigo}}' || chr(10) ||
    'Tema: {{tema}}' || chr(10) ||
    'Área: {{area}}' || chr(10) ||
    'Fecha de atención: {{fecha}}' || chr(10) ||
    'Creada por: {{creador}}' || chr(10) || chr(10) ||
    'Puedes responder este correo para escribirle directamente a quien la creó.',
  activo     boolean not null default true,   -- false = no se envían correos
  updated_at timestamptz not null default now(),
  constraint plantilla_unica check (id = 1)
);

-- Fila por defecto (idempotente).
insert into public.plantilla_correo (id) values (1)
  on conflict (id) do nothing;

-- RLS: todos los autenticados la LEEN (la app la necesita); solo el Director
-- la EDITA desde la pantalla de Ajustes. (La Edge Function usa service_role y
-- no pasa por RLS.)
alter table public.plantilla_correo enable row level security;
drop policy if exists plantilla_sel on public.plantilla_correo;
create policy plantilla_sel on public.plantilla_correo
  for select to authenticated using (true);
drop policy if exists plantilla_upd on public.plantilla_correo;
create policy plantilla_upd on public.plantilla_correo
  for all to authenticated
  using (public.mi_rol() = 'Director')
  with check (public.mi_rol() = 'Director');

-- ---------- 2) Correos de personas por NOMBRE ----------
-- El responsable directo de la tarea se guarda como NOMBRE (el mismo que está
-- en perfiles.nombre). Esta función traduce esos nombres a sus correos reales
-- (que viven en auth.users). security definer para poder leer auth.users sin
-- exponerla. La usa la Edge Function vía RPC.
-- OJO: la app guarda el responsable como NOMBRE CORTO derivado (sin los 2
-- apellidos finales y sin título). Ej.: guarda "Daniel de la Garza" aunque el
-- perfil sea "Daniel de la Garza Cordero", o "Mario Alberto" para
-- "Ing. Mario Alberto Ramírez Franca". Por eso NO se puede casar por igualdad
-- exacta: se casa por "el nombre del perfil EMPIEZA CON lo guardado" (tolerando
-- también un título profesional al inicio).
create or replace function public.correos_de_personas(p_nombres text[])
  returns table (nombre text, email text)
  language sql stable security definer set search_path = public as
$$
  select distinct p.nombre, u.email
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.activo = true
    and u.email is not null
    and exists (
      select 1
      from unnest(p_nombres) as req(n)
      where trim(req.n) <> ''
        and (
          p.nombre ilike trim(req.n) || '%'
          or regexp_replace(p.nombre,
               '^(ing|lic|arq|dr|dra|mtra|mtro|mat|bi[oó]l|c|prof|profa)\.\s*',
               '', 'i') ilike trim(req.n) || '%'
        )
    );
$$;

-- Verificación rápida (cambia los nombres por unos reales):
-- select * from public.correos_de_personas(array['Daniel de la Garza Cordero']);
