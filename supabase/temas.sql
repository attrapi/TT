-- =====================================================================
--  TT · Temas de SGOI (píldoras de clasificación)
--  Una tarea de SGOI se etiqueta con uno o varios temas (Semarnat-IA,
--  CONAGUA, INAH-MMHH…). Sirven para filtrar en la Sesión de Seguimiento:
--  "quiero repasar SGOI → CONAGUA" y solo se repasa ese bloque.
--
--  Dos piezas:
--    1) tareas.temas  → los temas de CADA tarea (arreglo JSON de textos).
--    2) temas_sgoi    → el CATÁLOGO de píldoras disponibles. Cuando alguien
--       agrega una píldora nueva desde el formulario, se guarda aquí y le
--       aparece a todos los demás.
--
--  Pegar en: Supabase → SQL Editor → New query → Run. Es idempotente.
-- =====================================================================

-- 1) Los temas de cada tarea.
alter table public.tareas add column if not exists temas jsonb not null default '[]'::jsonb;

-- 2) Catálogo compartido de píldoras.
create table if not exists public.temas_sgoi (
  nombre     text primary key,                       -- el texto de la píldora, tal cual se muestra
  creado_por text not null default '',
  creado_en  timestamptz not null default now()
);

alter table public.temas_sgoi enable row level security;

-- Cualquier usuario con sesión puede leer el catálogo y agregar píldoras
-- nuevas. Nadie las borra desde la app (se hace aquí con un delete manual).
drop policy if exists temas_sgoi_leer on public.temas_sgoi;
create policy temas_sgoi_leer on public.temas_sgoi
  for select to authenticated using (true);

drop policy if exists temas_sgoi_insertar on public.temas_sgoi;
create policy temas_sgoi_insertar on public.temas_sgoi
  for insert to authenticated with check (true);

-- Píldoras iniciales (las que ya se usan en SGOI). El on conflict evita
-- duplicarlas si se vuelve a correr el script.
insert into public.temas_sgoi (nombre) values
  ('Semarnat - IA'),
  ('Semarnat - CUSF'),
  ('PROFEPA'),
  ('INAH - ARQ'),
  ('INAH - MMHH'),
  ('CONAGUA'),
  ('CFE'),
  ('PEMEX'),
  ('CENAGAS'),
  ('PRIVADOS'),
  ('OTROS')
on conflict (nombre) do nothing;

-- Verificación
select 'temas listo' as resultado,
       (select count(*) from public.temas_sgoi) as pildoras_catalogo,
       (select count(*) from public.tareas where temas <> '[]'::jsonb) as tareas_etiquetadas;
