-- =====================================================================
--  TT · Seguridad por área (RLS afinada)
--  Reemplaza las políticas "todo a authenticated" por reglas por rol/área:
--    • Director (Adrián): TODO.
--    • Staff/Enlace (subdireccion ENLACE): tareas de ENLACE + DPAC.
--    • Jefe (tiene jefatura): SOLO las tareas de su jefatura (en su subdirección).
--    • Subdirector (sin jefatura): TODA su subdirección (incluye sus jefaturas).
--  La base solo entrega/acepta lo que corresponde a cada usuario.
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

-- ---------- TAREAS: por área ----------
drop policy if exists tareas_all on public.tareas;
drop policy if exists tareas_area on public.tareas;
create policy tareas_area on public.tareas for all to authenticated
  using      (public.puede_tarea(subdireccion, nivel, jefatura))
  with check (public.puede_tarea(subdireccion, nivel, jefatura));

-- ---------- BITÁCORA: solo de tareas que el usuario puede ver ----------
drop policy if exists bitacora_all on public.bitacora;
drop policy if exists bitacora_sel on public.bitacora;
drop policy if exists bitacora_ins on public.bitacora;
create policy bitacora_sel on public.bitacora for select to authenticated
  using (public.puede_ver_cod(tarea_codigo));
create policy bitacora_ins on public.bitacora for insert to authenticated
  with check (true);   -- cualquiera autenticado puede registrar un movimiento

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
