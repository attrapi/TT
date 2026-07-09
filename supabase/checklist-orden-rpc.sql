-- =====================================================================
--  TT · Reordenar las acciones del checklist (tt_checklist_orden)
--
--  La app permite ARRASTRAR las acciones para cambiarles el orden (mouse en
--  escritorio; mantener presionado y arrastrar en el celular). El orden es el
--  del arreglo jsonb `checklist` de la tarea.
--
--  Igual que tt_checklist_item, el cambio se hace DENTRO de la base con
--  candado de fila (FOR UPDATE) para no pisar cambios simultáneos:
--    • p_orden: lista [{uid, texto}, …] con el ORDEN deseado. Cada entrada se
--      empareja primero por uid y, si no aparece, por texto (ítems viejos).
--    • Las acciones de la fila que NO vengan en p_orden (p. ej. una que otra
--      persona agregó hace un momento) se CONSERVAN al final, en su orden.
--    • p_base: igual que en tt_checklist_item — solo si la fila aún tiene el
--      checklist VACÍO (sin materializar) se parte de la base del cliente.
--
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

create or replace function public.tt_checklist_orden(
  p_codigo text,
  p_orden  jsonb,
  p_base   jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lista jsonb;
  v_arr   jsonb[];
  v_usado boolean[];
  v_out   jsonb[] := array[]::jsonb[];
  v_n     int;
  v_idx   int;
  v_uid   text;
  v_txt   text;
  o       jsonb;
  i       int;
begin
  -- Candado de fila: serializa reordenamientos/guardados sobre la misma tarea.
  select coalesce(checklist, '[]'::jsonb) into v_lista
    from tareas where codigo = p_codigo
    for update;
  if not found then
    return null;   -- la tarea no existe (borrada); el front avisa
  end if;
  if jsonb_typeof(v_lista) <> 'array' then v_lista := '[]'::jsonb; end if;

  -- Fila sin checklist materializado: parte de la base local del cliente.
  if jsonb_array_length(v_lista) = 0
     and p_base is not null and jsonb_typeof(p_base) = 'array' then
    v_lista := p_base;
  end if;

  select coalesce(array_agg(x.e order by x.ord), array[]::jsonb[]) into v_arr
    from jsonb_array_elements(v_lista) with ordinality as x(e, ord);
  v_n := coalesce(array_length(v_arr, 1), 0);
  if v_n = 0 then return v_lista; end if;
  v_usado := array_fill(false, array[v_n]);

  -- Coloca primero, en el orden pedido, cada ítem que sí exista en la fila…
  if p_orden is not null and jsonb_typeof(p_orden) = 'array' then
    for o in select x.e from jsonb_array_elements(p_orden) as x(e) loop
      v_uid := coalesce(o->>'uid', '');
      v_txt := coalesce(o->>'texto', '');
      v_idx := 0;
      -- 1º por uid…
      if v_uid <> '' then
        for i in 1..v_n loop
          if not v_usado[i] and coalesce(v_arr[i]->>'uid', '') = v_uid then
            v_idx := i; exit;
          end if;
        end loop;
      end if;
      -- …y si no, por texto (ítems viejos sin uid / uid de otra sesión).
      if v_idx = 0 and v_txt <> '' then
        for i in 1..v_n loop
          if not v_usado[i] and coalesce(v_arr[i]->>'texto', '') = v_txt then
            v_idx := i; exit;
          end if;
        end loop;
      end if;
      if v_idx > 0 then
        v_out := v_out || v_arr[v_idx];
        v_usado[v_idx] := true;
      end if;
    end loop;
  end if;

  -- …y al final los que no venían (p. ej. agregados por otra persona a la vez).
  for i in 1..v_n loop
    if not v_usado[i] then v_out := v_out || v_arr[i]; end if;
  end loop;

  select coalesce(jsonb_agg(x.e order by x.ord), '[]'::jsonb) into v_lista
    from unnest(v_out) with ordinality as x(e, ord);
  update tareas set checklist = v_lista where codigo = p_codigo;
  return v_lista;   -- lista oficial ya reordenada (el front la adopta)
end;
$$;

-- Solo usuarios con sesión pueden llamarla (anon no).
revoke all on function public.tt_checklist_orden(text, jsonb, jsonb) from public, anon;
grant execute on function public.tt_checklist_orden(text, jsonb, jsonb) to authenticated;
