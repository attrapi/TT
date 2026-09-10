-- =====================================================================
--  TT · BLINDAJE — quitar el DELETE de `tareas` del alcance de la API
--
--  POR QUÉ. La papelera, los "¿estás seguro?" y los permisos de "quién puede
--  eliminar" viven en el FRONT, o sea en la máquina de quien ataca. Con una
--  sesión válida (una laptop abierta, una contraseña robada) bastaba esto en
--  la consola del navegador para vaciar la tabla en un segundo:
--
--      await sb.from('tareas').delete().neq('codigo','')
--
--  Lo permitía la política `tareas_all ... for all`, porque `for all` incluye
--  DELETE y `authenticated` es CUALQUIERA del equipo, no solo el Director.
--
--  QUÉ HACE. Cambia esa política por tres (select / insert / update) y NO crea
--  ninguna de delete. En Postgres, sin política que lo permita, la operación
--  se niega: la API rechaza el borrado aunque la sesión sea legítima.
--
--  QUÉ SE PIERDE. El botón "Eliminar definitivo" del Historial. Ya se quitó de
--  la app (PERMITIR_BORRADO_DEFINITIVO = false en index.html). El Historial
--  pasa a ser el estado final: la tarea sale de los tableros pero se conserva.
--  Para purgar de verdad, el admin lo hace desde aquí (ver el final).
--
--  ANTES DE CORRER: que `supabase/auditoria.sql` ya esté aplicado. Es la red
--  que permite resucitar lo que sí se llegue a borrar.
--
--  Pegar en: Supabase → SQL Editor → New query → Run. Es idempotente.
-- =====================================================================

-- ---------- TAREAS: leer, crear y editar sí; borrar NO ----------
drop policy if exists tareas_all  on public.tareas;
drop policy if exists tareas_area on public.tareas;
drop policy if exists tareas_sel  on public.tareas;
drop policy if exists tareas_ins  on public.tareas;
drop policy if exists tareas_upd  on public.tareas;

create policy tareas_sel on public.tareas for select to authenticated
  using (true);
create policy tareas_ins on public.tareas for insert to authenticated
  with check (true);
create policy tareas_upd on public.tareas for update to authenticated
  using (true) with check (true);
-- SIN política de DELETE, a propósito. No la agregues "por si acaso".


-- ---------- Verificación ----------
-- Deben salir 3 renglones (SELECT, INSERT, UPDATE) y NINGUNO que diga DELETE.
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'tareas'
order by cmd;

-- Prueba real (opcional): entra a la app como cualquier usuario, abre la
-- consola del navegador y corre
--     await sb.from('tareas').delete().eq('codigo','LA-QUE-SEA')
-- Debe responder 0 filas afectadas y la tarea seguir ahí.


-- =====================================================================
--  PURGA MANUAL (solo el admin, solo desde aquí)
--  El SQL Editor corre como dueño de la base y NO pasa por RLS, así que
--  desde aquí sí se puede borrar. Los triggers de auditoría siguen activos:
--  cada fila borrada queda guardada completa en public.auditoria.
--
--    delete from public.bitacora where tarea_codigo = 'SGOI-001';
--    delete from public.tareas    where codigo      = 'SGOI-001';
--
--  Para resucitar algo borrado (el id sale de la tabla auditoria):
--    insert into public.tareas
--    select * from jsonb_populate_record(null::public.tareas,
--      (select datos from public.auditoria where id = 123));
--
--  Qué se borró o cambió en las últimas 24 horas, y quién:
--    select en, usuario_email, tabla, operacion, fila_id
--    from public.auditoria
--    where en > now() - interval '24 hours'
--    order by en desc;
-- =====================================================================
