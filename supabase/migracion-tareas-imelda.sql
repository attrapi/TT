-- =====================================================================
--  TT · Pasar las tareas de Imelda de JDGA (SGOI-A) a JDGA-C (SGOI-C)
--
--  Correr DESPUÉS de que su perfil ya esté en subdireccion='SGOIC' /
--  jefatura='GESTION_AMBIENTAL_C'.
--
--  Qué cambia en cada tarea:
--    area                → 'JDGAC'
--    subdireccion        → 'SGOIC'
--    jefatura            → 'GESTION_AMBIENTAL_C'
--    participantes       → 'JDGA'→'JDGAC' y 'SGOI'→'SGOIC'   (esto es lo que
--                          decide en qué columna del tablero sale la tarea)
--    checklist.checks    → mismas dos renombradas (conserva los palomeos)
--    observaciones_areas → mismas dos renombradas (conserva las observaciones)
--
--  Lo que NO cambia: el `codigo` (JDGA-001…). Es el ID visible, ya está en la
--  bitácora y en los adjuntos; renumerarlo rompería el historial. La tarea se
--  muda de tablero pero conserva su nombre.
--
--  Pegar en: Supabase → SQL Editor → New query. Correr paso por paso.
-- =====================================================================

-- ---------- PASO 0: ver qué se va a mover (no cambia nada) ----------
-- Revisa la lista antes de seguir. Si aparece alguna que NO es de Imelda, o
-- falta alguna que sí es suya, avísame antes de correr el paso 2.
select codigo, area, subdireccion, jefatura, responsable, estatus, participantes
from public.tareas
where not eliminada
  and nivel = 'jefatura'
  and jefatura = 'GESTION_AMBIENTAL'
  and lower(responsable) like '%imelda%'
order by codigo;

-- Y por si algo suyo quedó fuera del filtro de arriba, esto lista TODO lo que
-- hoy vive en la JDGA de SGOI-A, sea de quien sea:
select codigo, responsable, estatus
from public.tareas
where not eliminada and nivel = 'jefatura' and jefatura = 'GESTION_AMBIENTAL'
order by responsable, codigo;


-- ---------- PASO 1: respaldo (para poder deshacer) ----------
drop table if exists public.tareas_backup_jdgac;
create table public.tareas_backup_jdgac as
select * from public.tareas
where nivel = 'jefatura'
  and jefatura = 'GESTION_AMBIENTAL'
  and lower(responsable) like '%imelda%';

-- Debe decir el mismo número de renglones que salió en el paso 0.
select count(*) as respaldadas from public.tareas_backup_jdgac;


-- ---------- PASO 2: la mudanza ----------
update public.tareas t set
  area         = 'JDGAC',
  subdireccion = 'SGOIC',
  jefatura     = 'GESTION_AMBIENTAL_C',

  -- Participantes: el arreglo que decide la columna del tablero.
  participantes = (
    select coalesce(jsonb_agg(
             case upper(p.cod) when 'JDGA' then 'JDGAC'
                               when 'SGOI' then 'SGOIC'
                               else p.cod end
             order by p.ord), '[]'::jsonb)
    from jsonb_array_elements_text(t.participantes) with ordinality as p(cod, ord)
  ),

  -- Observaciones guardadas por área.
  observaciones_areas = (
    select coalesce(jsonb_object_agg(
             case oa.nom when 'JDGA' then 'JDGAC'
                         when 'SGOI' then 'SGOIC'
                         else oa.nom end, oa.val), '{}'::jsonb)
    from jsonb_each(t.observaciones_areas) as oa(nom, val)
  ),

  -- Palomeos del checklist: cada renglón guarda { checks: { "JDGA": {...} } }.
  checklist = (
    select coalesce(jsonb_agg(
             case when jsonb_typeof(ci.item -> 'checks') = 'object'
                  then jsonb_set(ci.item, '{checks}', (
                         select coalesce(jsonb_object_agg(
                                  case ch.nom when 'JDGA' then 'JDGAC'
                                              when 'SGOI' then 'SGOIC'
                                              else ch.nom end, ch.val), '{}'::jsonb)
                         from jsonb_each(ci.item -> 'checks') as ch(nom, val)))
                  else ci.item end
             order by ci.ord), '[]'::jsonb)
    from jsonb_array_elements(t.checklist) with ordinality as ci(item, ord)
  )
where t.nivel = 'jefatura'
  and t.jefatura = 'GESTION_AMBIENTAL'
  and lower(t.responsable) like '%imelda%';


-- ---------- PASO 3: verificar ----------
-- Deben salir las mismas tareas del paso 0, ahora con JDGAC en participantes.
select codigo, area, subdireccion, jefatura, responsable, participantes
from public.tareas
where jefatura = 'GESTION_AMBIENTAL_C'
order by codigo;


-- ---------- DESHACER (solo si algo salió mal) ----------
-- update public.tareas t set
--   area                = b.area,
--   subdireccion        = b.subdireccion,
--   jefatura            = b.jefatura,
--   participantes       = b.participantes,
--   observaciones_areas = b.observaciones_areas,
--   checklist           = b.checklist
-- from public.tareas_backup_jdgac b
-- where t.id = b.id;

-- Cuando ya estés seguro de que quedó bien, puedes tirar el respaldo:
-- drop table public.tareas_backup_jdgac;
