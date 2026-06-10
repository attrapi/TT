-- =====================================================================
--  TT · Esquema Supabase (Postgres)
--  Migración desde Google Sheets. Las 9 hojas → 1 tabla `tareas` (columna `area`).
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run.
--  Es idempotente en lo posible (usa IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- ---------- 1) PERFILES (datos del usuario, ligados a Supabase Auth) ----------
-- Cada persona que inicia sesión tiene un perfil con su rol/área. El id es el
-- mismo del usuario de Auth (auth.users.id).
create table if not exists public.perfiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text not null default '',
  rol           text not null default 'Capturista',   -- 'Director' | 'Capturista'
  subdireccion  text not null default '',              -- SPAC | SGOI | SA | DPAC | ENLACE
  jefatura      text not null default '',              -- '' | PROCEDIMIENTOS | MANUALES | GESTION_AMBIENTAL | GESTION_OBRAS
  telefono      text not null default '',
  activo        boolean not null default true,
  es_enlace     boolean not null default false,      -- ENLACE: capturista que solo ve/atiende SUS tareas
  created_at    timestamptz not null default now()
);
-- Por si la tabla ya existía sin la columna:
alter table public.perfiles add column if not exists es_enlace boolean not null default false;
-- Nombre corto / "como se le conoce" para mostrar en Responsable directo
-- (ej. 'Nora Franco', 'Cesar Caballero', 'Daniel de la Garza'). Vacío = se deriva.
alter table public.perfiles add column if not exists nombre_corto text not null default '';

-- Al crear un usuario en Auth, se le crea su perfil automáticamente (rol básico).
-- Luego el admin ajusta rol/subdirección.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2) TAREAS (reemplaza las 9 hojas) ----------
create table if not exists public.tareas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text unique,                 -- ID visible: SPAC-001, JDPC-006, etc. (se autogenera)
  area               text not null,               -- DPAC|SPAC|JDPC|JDIMA|SGOI|JDGA|JDGOI|SA|ENLACE (la "hoja")
  subdireccion       text not null default '',    -- área dueña para permisos (SPAC/SGOI/SA/DPAC/ENLACE)
  nivel              text not null default 'subdireccion', -- 'subdireccion' | 'jefatura'
  jefatura           text not null default '',    -- código de jefatura (si aplica)
  responsable        text not null default '',
  tema               text not null default '',
  areas_involucradas text not null default '',
  acuerdos           text not null default '',
  accion             text not null default '',
  fecha              date,                         -- fecha de atención (null = permanente)
  permanente         boolean not null default false,
  estatus            text not null default 'En Proceso', -- 'En Proceso'|'Atendida'|'Archivada'
  url                text not null default '',     -- adjunto principal (link de Google Drive)
  checklist          jsonb not null default '[]',  -- [{texto, check_resp, check_dir, adjunto, adjunto_nombre}]
  observaciones_resp text not null default '',
  observaciones_dir  text not null default '',
  validada           boolean not null default false,
  en_validadas       boolean not null default false,
  confirmada         boolean not null default true,
  validado_por       text not null default '',
  fecha_validacion   text not null default '',
  finalizado_por     text not null default '',
  fecha_finalizacion text not null default '',
  enviado_por        text not null default '',
  fecha_envio        text not null default '',
  eliminada          boolean not null default false,
  eliminado_por      text not null default '',
  fecha_eliminacion  text not null default '',
  creado_por         text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_tareas_area    on public.tareas(area);
create index if not exists idx_tareas_estatus on public.tareas(estatus);
create index if not exists idx_tareas_elim     on public.tareas(eliminada);

-- Participantes: lista de áreas responsables de la tarea (DPAC/SPAC/JDPC/…). La
-- tarea aparece en el tablero de cada una y el checklist tiene una columna por
-- participante. Vacío = se deriva del área responsable + creador (tareas viejas).
alter table public.tareas
  add column if not exists participantes jsonb not null default '[]';

-- Adjuntos: lista de archivos de la tarea [{url, nombre}]. Reemplaza al campo
-- único `url` (que se conserva = primer adjunto, por compatibilidad).
alter table public.tareas
  add column if not exists adjuntos jsonb not null default '[]';

-- Observaciones por área participante: { "SPAC": "...", "JDIMA": "...", ... }.
-- Una caja de observaciones por participante (los campos legados
-- observaciones_resp/observaciones_dir se conservan por compatibilidad).
alter table public.tareas
  add column if not exists observaciones_areas jsonb not null default '{}';

-- Autogenera el `codigo` (PREFIJO-### por área) y actualiza updated_at.
create or replace function public.set_codigo_tarea()
returns trigger language plpgsql as $$
declare pref text; n int;
begin
  if new.codigo is null or new.codigo = '' then
    pref := upper(new.area) || '-';
    select coalesce(max( nullif(regexp_replace(codigo, '^.*-', ''), '')::int ), 0)
      into n from public.tareas where codigo like pref || '%';
    new.codigo := pref || lpad((n + 1)::text, 3, '0');
  end if;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_codigo_tarea on public.tareas;
create trigger trg_codigo_tarea
  before insert or update on public.tareas
  for each row execute function public.set_codigo_tarea();

-- ---------- 3) BITÁCORA (historial de movimientos) ----------
create table if not exists public.bitacora (
  id               bigint generated always as identity primary key,
  tarea_codigo     text not null default '',
  fecha            timestamptz not null default now(),
  usuario          text not null default '',
  accion           text not null default '',
  estatus_anterior text not null default '',
  estatus_nuevo    text not null default '',
  comentario       text not null default ''
);
create index if not exists idx_bitacora_tarea on public.bitacora(tarea_codigo);
create index if not exists idx_bitacora_fecha on public.bitacora(fecha desc);

-- ---------- 4) CATÁLOGO DE ÁREAS (las extra que se agregan con "Otra") ----------
create table if not exists public.areas_catalogo (
  id     bigint generated always as identity primary key,
  nombre text unique not null
);

-- =====================================================================
--  SEGURIDAD (RLS)
--  v1: equipo interno de confianza → cualquier usuario AUTENTICADO puede
--  ver/gestionar. Nadie sin login (anon) entra. Más adelante se puede
--  restringir por área. La llave pública NO sirve sin sesión válida.
-- =====================================================================
alter table public.perfiles       enable row level security;
alter table public.tareas         enable row level security;
alter table public.bitacora       enable row level security;
alter table public.areas_catalogo enable row level security;

-- perfiles
drop policy if exists perfiles_sel on public.perfiles;
create policy perfiles_sel on public.perfiles for select to authenticated using (true);
drop policy if exists perfiles_upd on public.perfiles;
create policy perfiles_upd on public.perfiles for update to authenticated using (true) with check (true);
drop policy if exists perfiles_ins on public.perfiles;
create policy perfiles_ins on public.perfiles for insert to authenticated with check (true);

-- tareas (todo a usuarios autenticados)
drop policy if exists tareas_all on public.tareas;
create policy tareas_all on public.tareas for all to authenticated using (true) with check (true);

-- bitácora
drop policy if exists bitacora_all on public.bitacora;
create policy bitacora_all on public.bitacora for all to authenticated using (true) with check (true);

-- catálogo de áreas
drop policy if exists areas_all on public.areas_catalogo;
create policy areas_all on public.areas_catalogo for all to authenticated using (true) with check (true);

-- Listo. Ahora: crear los usuarios (Auth) y migrar los datos de las hojas.
