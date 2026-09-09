-- =====================================================================
--  TT · Pasar las tareas de la JDGA de SGOI-A a la JDGA-C de SGOI-C
--
--  Correr DESPUÉS de que su perfil ya esté en subdireccion='SGOIC' /
--  jefatura='GESTION_AMBIENTAL_C'.
--
--  Al correr el PASO 0 (2026-09-09) salieron 21 tareas, TODAS de la misma
--  persona: ella es la única en la JDGA de SGOI-A, así que la jefatura entera
--  se muda. Varias ya traían 'SGOIC' entre sus participantes, y dos traían
--  'SGOI' y 'SGOIC' a la vez — por eso el paso 2 DEDUPLICA al renombrar.
--
--  Qué cambia en cada tarea:
--    area                → 'JDGAC'
--    subdireccion        → 'SGOIC'
--    jefatura            → 'GESTION_AMBIENTAL_C'
--    participantes       → 'JDGA'→'JDGAC' y 'SGOI'→'SGOIC', sin repetidos
--                          (este arreglo es el que decide en qué columna del
--                          tablero sale la tarea)
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
select codigo, area, subdireccion, jefatura, responsable, estatus, participantes
from public.tareas
where not eliminada
  and nivel = 'jefatura'
  and jefatura = 'GESTION_AMBIENTAL'
  and lower(responsable) like '%imelda%'
order by codigo;

-- Y por si algo suyo quedó fuera del filtro de arriba, esto lista TODO lo que
-- hoy vive en la JDGA de SGOI-A, sea de quien sea. Si devuelve lo mismo que la
-- consulta anterior, la jefatura es de una sola persona y se muda completa.
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

  -- Participantes: el arreglo que decide la columna del tablero. El GROUP BY
  -- deduplica: una tarea con ["JDGA","SGOI","SGOIC"] quedaría con SGOIC dos
  -- veces (y dos columnas iguales en el checklist) si solo se renombrara.
  -- Se conserva el orden de la primera aparición (min(ord)).
  participantes = (
    select coalesce(jsonb_agg(x.cod order by x.ord), '[]'::jsonb)
    from (
      select case upper(p.cod) when 'JDGA' then 'JDGAC'
                               when 'SGOI' then 'SGOIC'
                               else upper(p.cod) end as cod,
             min(p.ord) as ord
      from jsonb_array_elements_text(t.participantes) with ordinality as p(cod, ord)
      group by 1
    ) x
  ),

  -- Observaciones guardadas por área. Si la tarea traía observación de SGOI y
  -- de SGOIC, al fusionarse gana la que tiene texto (la más larga).
  observaciones_areas = (
    select coalesce(jsonb_object_agg(y.nom, y.val), '{}'::jsonb)
    from (
      select distinct on (z.nom) z.nom, z.val
      from (
        select case oa.nom when 'JDGA' then 'JDGAC'
                           when 'SGOI' then 'SGOIC'
                           else oa.nom end as nom,
               oa.val
        from jsonb_each(t.observaciones_areas) as oa(nom, val)
      ) z
      order by z.nom, length(z.val::text) desc
    ) y
  ),

  -- Palomeos del checklist: cada renglón guarda { checks: { "JDGA": {...} } }.
  -- Si al fusionar SGOI y SGOIC chocan, gana el que esté marcado.
  checklist = (
    select coalesce(jsonb_agg(
             case when jsonb_typeof(ci.item -> 'checks') = 'object'
                  then jsonb_set(ci.item, '{checks}', (
                         select coalesce(jsonb_object_agg(w.nom, w.val), '{}'::jsonb)
                         from (
                           select distinct on (q.nom) q.nom, q.val
                           from (
                             select case ch.nom when 'JDGA' then 'JDGAC'
                                                when 'SGOI' then 'SGOIC'
                                                else ch.nom end as nom,
                                    ch.val
                             from jsonb_each(ci.item -> 'checks') as ch(nom, val)
                           ) q
                           order by q.nom, (q.val ->> 'marcado') desc nulls last
                         ) w))
                  else ci.item end
             order by ci.ord), '[]'::jsonb)
    from jsonb_array_elements(t.checklist) with ordinality as ci(item, ord)
  )
where t.nivel = 'jefatura'
  and t.jefatura = 'GESTION_AMBIENTAL'
  and lower(t.responsable) like '%imelda%';


-- ---------- PASO 3: verificar ----------
-- Deben salir las mismas tareas del paso 0, con JDGAC en participantes y SIN
-- códigos repetidos dentro del arreglo.
select codigo, area, subdireccion, jefatura, responsable, participantes
from public.tareas
where jefatura = 'GESTION_AMBIENTAL_C'
order by codigo;


-- ---------- PASO 4 (opcional): tareas suyas donde su jefatura NO participa --
-- Puede haber tareas asignadas a ella cuyo arreglo `participantes` nunca
-- incluyó a la jefatura (p. ej. SGOI-009, con ["SGOI","DPAC"]). Esas NO le
-- aparecen en su tablero — ni antes ni después de la mudanza — porque un jefe
-- solo ve las tareas donde SU área participa. Este select las encuentra:
select codigo, responsable, estatus, participantes
from public.tareas
where not eliminada
  and jefatura = 'GESTION_AMBIENTAL_C'
  and not (participantes @> '["JDGAC"]'::jsonb);

-- Si quieres que también las vea, esto le agrega su columna (deja intactas las
-- demás áreas y los palomeos existentes):
-- update public.tareas
--    set participantes = participantes || '["JDGAC"]'::jsonb
--  where not eliminada
--    and jefatura = 'GESTION_AMBIENTAL_C'
--    and not (participantes @> '["JDGAC"]'::jsonb);


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
