-- =====================================================================
--  TT · Bitácora "crear" garantizada por la BASE (no por el front)
--  Problema: la entrada de bitácora "crear" la insertaba el shim con una
--  llamada aparte (fire-and-forget, error descartado). Si esa llamada
--  fallaba (RLS/red/token), la tarea quedaba creada SIN su registro de
--  "creada" — p.ej. DPAC-004 no mostraba "Adrián creó la tarea".
--
--  Arreglo: un trigger AFTER INSERT en `tareas` escribe el registro
--  "crear" en la MISMA transacción → nunca puede faltar.
--
--  Pegar TODO en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- 1) BACKFILL: tareas que ya existen pero NO tienen "crear" ----------
-- Usa el creador y la fecha REALES guardados en la propia fila de la tarea.
-- Idempotente: solo inserta donde falta (incluye DPAC-004).
insert into public.bitacora (tarea_codigo, fecha, usuario, accion, estatus_anterior, estatus_nuevo)
select t.codigo, t.created_at, t.creado_por, 'crear', '—', coalesce(nullif(t.estatus, ''), 'En Proceso')
from public.tareas t
where coalesce(t.codigo, '') <> ''
  and not exists (
    select 1 from public.bitacora b
    where b.tarea_codigo = t.codigo and b.accion = 'crear'
  );

-- ---------- 2) TRIGGER: garantizar "crear" en cada alta futura ----------
create or replace function public.log_crear_tarea()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.bitacora (tarea_codigo, fecha, usuario, accion, estatus_anterior, estatus_nuevo)
  values (new.codigo, new.created_at, new.creado_por, 'crear', '—', coalesce(nullif(new.estatus, ''), 'En Proceso'));
  return new;
end; $$;

drop trigger if exists trg_log_crear_tarea on public.tareas;
create trigger trg_log_crear_tarea
  after insert on public.tareas
  for each row execute function public.log_crear_tarea();

-- Verificación (opcional):
-- select tarea_codigo, usuario, fecha from public.bitacora where accion = 'crear' order by fecha desc;
