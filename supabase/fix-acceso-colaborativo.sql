-- =====================================================================
--  TT · Acceso colaborativo (equipo de confianza, ~9 personas)
--  Motivo: las tareas pueden ser EN COMÚN o asignadas entre áreas (una tarea
--  de una subdirección con gente de otra subdirección/jefatura/enlace/dirección
--  involucrada). El TABLERO de cada quien lo arma el front (por área, por
--  responsable y por asignación/participantes); para eso la base debe ENTREGAR
--  las tareas y dejar que el front filtre. La regla vieja `tareas_area` filtraba
--  SOLO por área, así que una tarea asignada a alguien de otra área no le llegaba
--  → no le aparecía en su tablero ni podía comentar el hilo.
--
--  Arreglo: cualquier usuario AUTENTICADO ve/gestiona las tareas y la bitácora.
--  `anon` (sin login) sigue sin acceso. Si algún día se quiere cerrar por área,
--  los helpers (mi_rol, puede_tarea, …) siguen en rls.sql para reusarlos.
--
--  Reemplaza al parche anterior `fix-bitacora-lectura.sql` (lo incluye).
--  Pegar TODO en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- TAREAS: cualquier autenticado (el front arma cada tablero) ----------
drop policy if exists tareas_all  on public.tareas;
drop policy if exists tareas_area on public.tareas;
create policy tareas_all on public.tareas for all to authenticated
  using (true) with check (true);

-- ---------- BITÁCORA: hilos/vistos/movimientos para cualquier autenticado ----------
drop policy if exists bitacora_all on public.bitacora;
drop policy if exists bitacora_sel on public.bitacora;
drop policy if exists bitacora_ins on public.bitacora;
drop policy if exists bitacora_del on public.bitacora;
create policy bitacora_sel on public.bitacora for select to authenticated using (true);
create policy bitacora_ins on public.bitacora for insert to authenticated with check (true);
create policy bitacora_del on public.bitacora for delete to authenticated using (true);

-- Verificación (opcional):
-- select tablename, policyname, cmd, qual, with_check
--   from pg_policies where tablename in ('tareas','bitacora') order by tablename, cmd;
