-- =====================================================================
--  TT · Arreglo: los hilos (comentarios) de Mario "se borraban" al recargar
--  Causa: la INSERCIÓN en bitácora está abierta a cualquier autenticado
--  (with check true), pero la LECTURA (bitacora_sel) solo dejaba ver la
--  bitácora de tareas del ÁREA del usuario (puede_ver_cod). Mario, subdirector
--  de SPAC, ve TODAS las tareas en pantalla (en el front se trata como
--  Dirección), así que comenta en tareas de otras subdirecciones: el comentario
--  se guarda, pero al recargar la regla de lectura lo oculta → "se borró el hilo".
--  Los demás comentan solo en su propia área, por eso a ellos sí se les guarda.
--
--  Arreglo: igualar la LECTURA (y el borrado) a la INSERCIÓN → cualquier
--  usuario autenticado puede leer toda la bitácora. El equipo son ~9 personas
--  de confianza y la bitácora son notas internas; quien puede comentar en una
--  tarea debe poder volver a leer el hilo completo.
--
--  Pegar TODO en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

drop policy if exists bitacora_sel on public.bitacora;
create policy bitacora_sel on public.bitacora for select to authenticated
  using (true);

drop policy if exists bitacora_del on public.bitacora;
create policy bitacora_del on public.bitacora for delete to authenticated
  using (true);

-- Verificación (opcional): debe listar bitacora_sel / bitacora_ins / bitacora_del.
-- select policyname, cmd, qual, with_check from pg_policies where tablename = 'bitacora';
