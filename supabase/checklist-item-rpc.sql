-- =====================================================================
--  TT · Guardado ATÓMICO por acción del checklist (tt_checklist_item)
--
--  PROBLEMA que resuelve: la app mandaba el checklist COMPLETO desde la copia
--  local en cada guardado. Si esa copia estaba vieja (otro usuario con el modal
--  abierto, o una recarga que ganó la carrera al UPDATE), el guardado
--  sobre-escribía y BORRABA acciones agregadas por otra persona (p. ej. la
--  tarea SPAC-006 "OOII - Visor + ACONEX").
--
--  SOLUCIÓN: esta función mezcla UNA sola acción (alta/edición/palomeo/
--  adjunto/borrado) DENTRO de la base, con candado de fila (FOR UPDATE).
--  Dos personas trabajando a la vez ya no se pisan: cada quien toca solo su
--  ítem y la lista final es la unión de ambos.
--
--  Identidad del ítem: primero por `uid` (los ítems nuevos lo traen); si no,
--  por su `texto` (ítems viejos sin uid, o derivados del texto "Acciones a
--  tomar", cuyo uid cambia por sesión).
--
--  p_base: checklist derivado localmente. Solo se usa si la fila aún tiene el
--  checklist VACÍO (tareas recién creadas o viejas sin materializar), para no
--  perder las demás acciones derivadas al guardar la primera.
--
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

create or replace function public.tt_checklist_item(
  p_codigo text,
  p_uid    text    default '',
  p_texto  text    default '',
  p_item   jsonb   default null,
  p_borrar boolean default false,
  p_base   jsonb   default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lista jsonb;
  v_arr   jsonb[];
  v_n     int;
  v_idx   int := 0;
  i       int;
begin
  -- Candado de fila: serializa guardados simultáneos sobre la misma tarea.
  select coalesce(checklist, '[]'::jsonb) into v_lista
    from tareas where codigo = p_codigo
    for update;
  if not found then
    return null;   -- la tarea no existe (borrada); el front avisa
  end if;
  if jsonb_typeof(v_lista) <> 'array' then v_lista := '[]'::jsonb; end if;

  -- Fila sin checklist materializado: parte de la base local del cliente
  -- (las acciones derivadas del texto), para no dejar fuera a las demás.
  if jsonb_array_length(v_lista) = 0
     and p_base is not null and jsonb_typeof(p_base) = 'array' then
    v_lista := p_base;
  end if;

  select coalesce(array_agg(x.e order by x.ord), array[]::jsonb[]) into v_arr
    from jsonb_array_elements(v_lista) with ordinality as x(e, ord);
  v_n := coalesce(array_length(v_arr, 1), 0);

  -- 1º intenta ubicar el ítem por uid…
  if coalesce(p_uid, '') <> '' then
    for i in 1..v_n loop
      if coalesce(v_arr[i]->>'uid', '') = p_uid then v_idx := i; exit; end if;
    end loop;
  end if;
  -- …y si no, por texto (ítems viejos sin uid / uid de otra sesión).
  if v_idx = 0 and coalesce(p_texto, '') <> '' then
    for i in 1..v_n loop
      if coalesce(v_arr[i]->>'texto', '') = p_texto then v_idx := i; exit; end if;
    end loop;
  end if;

  if p_borrar then
    if v_idx > 0 then
      v_arr := v_arr[1:v_idx-1] || v_arr[v_idx+1:];
    end if;
  elsif p_item is not null then
    if v_idx > 0 then
      v_arr[v_idx] := p_item;          -- edición/palomeo: reemplaza en su lugar
    else
      v_arr := v_arr || p_item;        -- alta: se agrega al final
    end if;
  end if;

  select coalesce(jsonb_agg(x.e order by x.ord), '[]'::jsonb) into v_lista
    from unnest(v_arr) with ordinality as x(e, ord);
  update tareas set checklist = v_lista where codigo = p_codigo;
  return v_lista;   -- lista oficial ya mezclada (el front la adopta)
end;
$$;

-- Solo usuarios con sesión pueden llamarla (anon no).
revoke all on function public.tt_checklist_item(text, text, text, jsonb, boolean, jsonb) from public, anon;
grant execute on function public.tt_checklist_item(text, text, text, jsonb, boolean, jsonb) to authenticated;

-- Verificación rápida (con una tarea de prueba):
-- select public.tt_checklist_item('SPAC-006', '', 'texto de una acción',
--   '{"uid":"prueba1","texto":"texto de una acción","check_resp":false}'::jsonb, false, null);
