-- =====================================================================
--  TT · Verificación: ¿qué le falta a la base?
--  Pega esto en Supabase → SQL Editor → Run. NO cambia nada, solo revisa.
--  Cada renglón dice si esa pieza ya está o qué archivo hay que correr.
-- =====================================================================

with revisiones as (

  -- ---- Tablas ----
  select 'tabla · tareas'        as pieza, to_regclass('public.tareas')        is not null as ok, 'schema.sql' as correr union all
  select 'tabla · perfiles',            to_regclass('public.perfiles')         is not null, 'perfiles.sql' union all
  select 'tabla · bitacora',            to_regclass('public.bitacora')         is not null, 'migracion-bitacora.sql' union all
  select 'tabla · volantes',            to_regclass('public.volantes')         is not null, 'volantes.sql' union all
  select 'tabla · temas_sgoi',          to_regclass('public.temas_sgoi')       is not null, 'temas.sql' union all
  select 'tabla · areas_catalogo',      to_regclass('public.areas_catalogo')   is not null, 'schema.sql' union all
  select 'tabla · plantilla_correo',    to_regclass('public.plantilla_correo') is not null, 'correo-tareas.sql' union all

  -- ---- Columnas de `tareas` que la app usa ----
  select 'columna · tareas.temas',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tareas' and column_name='temas'),
         'temas.sql' union all
  select 'columna · tareas.seguimiento_en',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tareas' and column_name='seguimiento_en'),
         'seguimiento.sql' union all
  select 'columna · tareas.proyecto',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tareas' and column_name='proyecto'),
         'proyectos.sql' union all
  select 'columna · tareas.tramo',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tareas' and column_name='tramo'),
         'proyectos.sql' union all
  select 'columna · perfiles.notif_leidas',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='perfiles' and column_name='notif_leidas'),
         'notificaciones.sql' union all
  select 'columna · tareas.participantes',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tareas' and column_name='participantes'),
         'schema.sql' union all
  select 'columna · tareas.adjuntos',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tareas' and column_name='adjuntos'),
         'schema.sql' union all
  select 'columna · tareas.enlaces',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tareas' and column_name='enlaces'),
         'schema.sql' union all
  select 'columna · tareas.checklist_iniciado',
         exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='tareas' and column_name='checklist_iniciado'),
         'schema.sql' union all

  -- ---- Funciones que la app llama por RPC ----
  select 'rpc · tt_checklist_item',   exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                              where n.nspname='public' and p.proname='tt_checklist_item'),
         'checklist-item-rpc.sql' union all
  select 'rpc · tt_checklist_orden',  exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                              where n.nspname='public' and p.proname='tt_checklist_orden'),
         'checklist-orden-rpc.sql' union all
  select 'rpc · correos_de_personas', exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                              where n.nspname='public' and p.proname='correos_de_personas'),
         'correo-tareas.sql' union all

  -- ---- Trigger que escribe la bitácora al crear una tarea ----
  select 'trigger · trg_log_crear_tarea',
         exists (select 1 from pg_trigger where tgname='trg_log_crear_tarea' and not tgisinternal),
         'bitacora-crear-trigger.sql'
)
select
  case when ok then '✅ ya está' else '❌ FALTA' end as estado,
  pieza,
  case when ok then '—' else correr end as que_correr
from revisiones
order by ok, pieza;
