-- =====================================================================
--  TT · Proyecto y tramo de la tarea
--  Cada tarea se ubica en un PROYECTO (un tramo ferroviario de Fase I o
--  Fase II) y, más adelante, en un TRAMO dentro de ese proyecto.
--  Con esto la Sesión de Seguimiento se puede filtrar por proyecto igual
--  que ya se filtra por área y por tema de SGOI.
--
--  La lista de proyectos NO vive en la base: es fija y está en index.html
--  (PROYECTOS_FASES). Aquí solo se guarda cuál le tocó a cada tarea.
--
--  La columna `tramo` se crea desde ahora aunque la app todavía no la
--  capture, para no tener que volver a migrar cuando llegue la lista de
--  tramos. Mientras tanto se queda vacía y no estorba.
--
--  Pegar en: Supabase → SQL Editor → New query → Run. Es idempotente.
-- =====================================================================

alter table public.tareas add column if not exists proyecto text not null default '';
alter table public.tareas add column if not exists tramo    text not null default '';

-- Una tarea puede tocar VARIOS tramos (p. ej. "AIFA - Pachuca" y "México -
-- Querétaro"): `proyectos` es la columna buena (arreglo JSON, igual que
-- `temas`). `proyecto` se queda para leer tareas viejas de un solo tramo.
alter table public.tareas add column if not exists proyectos jsonb not null default '[]'::jsonb;

-- Migración: las tareas que ya tenían su único proyecto en `proyecto` lo
-- pasan al arreglo. Idempotente: solo toca las que siguen con el arreglo vacío.
update public.tareas
   set proyectos = jsonb_build_array(proyecto)
 where proyecto <> '' and proyectos = '[]'::jsonb;

-- Para que filtrar por proyecto sea rápido cuando haya muchas tareas.
create index if not exists tareas_proyecto_idx on public.tareas (proyecto) where proyecto <> '';

-- Verificación
select 'proyectos listo' as resultado,
       count(*) filter (where proyectos <> '[]'::jsonb) as con_proyecto,
       count(*) filter (where tramo <> '') as con_tramo,
       count(*) as total
from public.tareas;
