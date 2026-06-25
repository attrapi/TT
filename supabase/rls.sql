-- =====================================================================
--  TT · RLS — acceso colaborativo (equipo de confianza, ~9 personas)
--  Las tareas pueden ser EN COMÚN / asignadas entre áreas, y el TABLERO de cada
--  quien lo arma el FRONT (por área, responsable y asignación/participantes).
--  Por eso la base entrega TODO a cualquier usuario AUTENTICADO y deja que el
--  front filtre; `anon` (sin login) sin acceso.
--
--  Los helpers de abajo (mi_rol, mi_sub, puede_tarea, …) se conservan por si en
--  el futuro se quiere CERRAR por área; hoy NO los usa la política de tareas.
--  perfiles_admin sí usa mi_rol() (solo el Director edita perfiles).
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- helpers: datos del usuario logueado (sin recursión de RLS) ----------
create or replace function public.mi_rol() returns text
  language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where id = auth.uid() $$;

create or replace function public.mi_sub() returns text
  language sql stable security definer set search_path = public as
$$ select upper(coalesce(subdireccion,'')) from public.perfiles where id = auth.uid() $$;

create or replace function public.mi_jefatura() returns text
  language sql stable security definer set search_path = public as
$$ select upper(coalesce(jefatura,'')) from public.perfiles where id = auth.uid() $$;

-- ¿El usuario actual puede ver/gestionar una tarea con estos datos?
create or replace function public.puede_tarea(p_sub text, p_niv text, p_jef text)
  returns boolean language sql stable security definer set search_path = public as
$$
  select
    public.mi_rol() = 'Director'
    or (public.mi_sub() = 'ENLACE' and upper(coalesce(p_sub,'')) in ('ENLACE','DPAC'))
    or (public.mi_jefatura() <> '' and upper(coalesce(p_sub,'')) = public.mi_sub()
        and p_niv = 'jefatura' and upper(coalesce(p_jef,'')) = public.mi_jefatura())
    or (public.mi_jefatura() = '' and public.mi_sub() not in ('ENLACE','')
        and upper(coalesce(p_sub,'')) = public.mi_sub());
$$;

-- ¿Puede ver la tarea de cierto código? (para la bitácora; definer = sin recursión)
create or replace function public.puede_ver_cod(p_cod text)
  returns boolean language sql stable security definer set search_path = public as
$$
  select public.mi_rol() = 'Director' or exists(
    select 1 from public.tareas t
    where t.codigo = p_cod and public.puede_tarea(t.subdireccion, t.nivel, t.jefatura)
  );
$$;

-- ---------- TAREAS: cualquier autenticado (el front arma cada tablero) ----------
-- No se filtra por área: una tarea EN COMÚN / asignada a otra área debe llegarle
-- a esa persona para que le aparezca en su tablero y pueda comentar su hilo. El
-- filtrado por área/responsable/asignación lo hace el front.
drop policy if exists tareas_all on public.tareas;
drop policy if exists tareas_area on public.tareas;
create policy tareas_all on public.tareas for all to authenticated
  using (true) with check (true);

-- ---------- BITÁCORA: hilos/vistos/movimientos para cualquier autenticado ----------
-- Va pareja con tareas: quien ve una tarea (propia, en común o asignada) puede
-- leer y escribir su hilo. Antes la lectura se limitaba por área (puede_ver_cod)
-- mientras la escritura estaba abierta → los comentarios en tareas de otra área
-- "desaparecían" al recargar (le pasaba a Mario, que ve todas las tareas).
drop policy if exists bitacora_all on public.bitacora;
drop policy if exists bitacora_sel on public.bitacora;
drop policy if exists bitacora_ins on public.bitacora;
create policy bitacora_sel on public.bitacora for select to authenticated
  using (true);
create policy bitacora_ins on public.bitacora for insert to authenticated
  with check (true);   -- cualquiera autenticado puede registrar un movimiento
-- Borrado: lo usa el borrado definitivo de una tarea (la app elimina la bitácora
-- ANTES que la tarea, para que no quede historial si el ID se reutiliza). Va
-- pareja con la lectura para no dejar bitácora huérfana al purgar una tarea.
drop policy if exists bitacora_del on public.bitacora;
create policy bitacora_del on public.bitacora for delete to authenticated
  using (true);

-- ---------- PERFILES: todos leen (para listas de responsables); solo Director edita ----------
drop policy if exists perfiles_sel on public.perfiles;
drop policy if exists perfiles_upd on public.perfiles;
drop policy if exists perfiles_ins on public.perfiles;
drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_sel on public.perfiles for select to authenticated using (true);
create policy perfiles_admin on public.perfiles for all to authenticated
  using (public.mi_rol() = 'Director') with check (public.mi_rol() = 'Director');

-- ---------- CATÁLOGO DE ÁREAS: lectura/alta para autenticados (sin cambio) ----------
-- (areas_catalogo se queda como estaba: todo a authenticated)

-- Verificación rápida (corre como Director para ver todo; como otro, solo lo suyo):
-- select codigo, area, subdireccion, nivel, jefatura from public.tareas;
