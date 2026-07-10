-- =====================================================================
--  TT · VOLANTES (registro de SGOI)
--  Tabla para el apartado "Volantes" del menú lateral (solo lo ve el
--  equipo de SGOI y la Dirección; la restricción de quién lo VE la pone
--  la app — aquí el acceso es para cualquier usuario autenticado, igual
--  que el resto de las tablas v1).
--  El No. de volante se captura A MANO (lleva su propia estructura, ej.
--  VOL-001-2026-001) y se guarda en MAYÚSCULAS; no puede repetirse.
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

create table if not exists public.volantes (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null default '',   -- No. de volante (manual, MAYÚSCULAS)
  fecha_recepcion date,
  fecha_documento date,
  turnado_a       text not null default '',
  remitente       text not null default '',
  referencia      text not null default '',
  tipo_atencion   text not null default '',
  asunto          text not null default '',
  estatus         text not null default 'En proceso',  -- 'En proceso' | 'Atendido'
  atendido_por    text not null default '',
  fecha_atendido  timestamptz,
  checklist       jsonb not null default '[]',  -- acciones: [{uid, texto, hecho}]
  adjuntos        jsonb not null default '[]',  -- documentos en Drive: [{url, nombre}]
  creado_por      text not null default '',   -- nombre del usuario que lo registró
  created_at      timestamptz not null default now()
);
-- Por si la tabla ya existía de la versión anterior (sin estatus/checklist):
alter table public.volantes add column if not exists estatus        text not null default 'En proceso';
alter table public.volantes add column if not exists atendido_por   text not null default '';
alter table public.volantes add column if not exists fecha_atendido timestamptz;
alter table public.volantes add column if not exists checklist      jsonb not null default '[]';
alter table public.volantes add column if not exists adjuntos       jsonb not null default '[]';

-- El HILO de comentarios y la BITÁCORA de cada volante viven en la tabla
-- `bitacora` ya existente, con tarea_codigo = 'VOL:<uuid del volante>'.
-- (El shim los excluye de la bitácora general de tareas.)

-- El mismo número no puede registrarse dos veces (sin importar mayúsculas).
create unique index if not exists volantes_numero_unico
  on public.volantes (upper(numero));

-- RLS v1 (mismo criterio que el resto): todo a usuarios autenticados, anon nada.
alter table public.volantes enable row level security;
drop policy if exists volantes_sel on public.volantes;
drop policy if exists volantes_ins on public.volantes;
drop policy if exists volantes_upd on public.volantes;
drop policy if exists volantes_del on public.volantes;
create policy volantes_sel on public.volantes for select to authenticated using (true);
create policy volantes_ins on public.volantes for insert to authenticated with check (true);
create policy volantes_upd on public.volantes for update to authenticated using (true) with check (true);
create policy volantes_del on public.volantes for delete to authenticated using (true);

-- Tiempo real: si alguien registra un volante, a los demás les aparece solo.
-- (Si la tabla ya estaba en la publicación, el bloque no truena.)
do $$
begin
  alter publication supabase_realtime add table public.volantes;
exception when duplicate_object then null;
end $$;

-- Verificación
select 'volantes lista' as resultado, count(*) as filas from public.volantes;
