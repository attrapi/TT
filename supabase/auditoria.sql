-- =====================================================================
--  TT · AUDITORÍA — red de seguridad contra borrados y cambios maliciosos
--  Antes de CUALQUIER update o delete en las tablas importantes, se guarda
--  una copia completa de la fila (cómo estaba ANTES), con quién lo hizo y
--  cuándo. La tabla es INVISIBLE e intocable desde la app (RLS sin
--  políticas): ni siquiera un usuario autenticado puede leerla, escribirla
--  o borrarla por la API. Solo se consulta desde el SQL Editor.
--  Pegar TODO en: Supabase → SQL Editor → New query → Run. Es idempotente.
-- =====================================================================

-- ---------- 1) La tabla ----------
create table if not exists public.auditoria (
  id            bigint generated always as identity primary key,
  tabla         text not null,                    -- tareas | volantes | bitacora | perfiles | areas_catalogo
  operacion     text not null,                    -- UPDATE | DELETE
  fila_id       text not null default '',        -- identificador visible (codigo / numero / id)
  datos         jsonb not null,                  -- la fila COMPLETA antes del cambio
  usuario_id    uuid,                            -- auth.uid() de quien lo hizo (null = SQL Editor / sistema)
  usuario_email text not null default '',
  en            timestamptz not null default now()
);
create index if not exists idx_auditoria_en    on public.auditoria(en desc);
create index if not exists idx_auditoria_tabla on public.auditoria(tabla, fila_id);

-- RLS SIN políticas = nadie entra por la API (ni authenticated, ni anon).
-- El trigger escribe porque su función es SECURITY DEFINER (corre como dueño).
alter table public.auditoria enable row level security;

-- ---------- 2) La función del trigger ----------
create or replace function public.tt_auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
begin
  j := to_jsonb(old);
  insert into public.auditoria (tabla, operacion, fila_id, datos, usuario_id, usuario_email)
  values (
    tg_table_name,
    tg_op,
    coalesce(j->>'codigo', j->>'numero', j->>'id', ''),
    j,
    auth.uid(),
    coalesce(auth.jwt()->>'email', '')
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

-- ---------- 3) Los triggers (update + delete; los insert no hacen falta:
--              lo nuevo ya vive en la tabla) ----------
-- NOTA: juego_progreso queda FUERA a propósito (se actualiza a cada respuesta
-- del juego y llenaría la auditoría de ruido sin valor).
drop trigger if exists auditar_tareas on public.tareas;
create trigger auditar_tareas
  before update or delete on public.tareas
  for each row execute function public.tt_auditar();

drop trigger if exists auditar_volantes on public.volantes;
create trigger auditar_volantes
  before update or delete on public.volantes
  for each row execute function public.tt_auditar();

drop trigger if exists auditar_bitacora on public.bitacora;
create trigger auditar_bitacora
  before update or delete on public.bitacora
  for each row execute function public.tt_auditar();

drop trigger if exists auditar_perfiles on public.perfiles;
create trigger auditar_perfiles
  before update or delete on public.perfiles
  for each row execute function public.tt_auditar();

drop trigger if exists auditar_areas on public.areas_catalogo;
create trigger auditar_areas
  before update or delete on public.areas_catalogo
  for each row execute function public.tt_auditar();

-- ---------- 4) Verificación ----------
-- Debe listar los 5 triggers recién creados:
select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_name like 'auditar_%'
group by 1, 2 order by 1;

-- =====================================================================
--  CHULETA (para el día que haga falta — se corre en el SQL Editor):
--
--  ¿Qué se borró o cambió en las últimas 24 horas y quién lo hizo?
--    select en, usuario_email, tabla, operacion, fila_id
--    from public.auditoria
--    where en > now() - interval '24 hours'
--    order by en desc;
--
--  Ver cómo estaba una tarea antes (todas sus versiones guardadas):
--    select en, operacion, usuario_email, datos
--    from public.auditoria
--    where tabla = 'tareas' and fila_id = 'SGOI-001'
--    order by en desc;
--
--  RESUCITAR una tarea borrada (usa el id de la fila de auditoría):
--    insert into public.tareas
--    select * from jsonb_populate_record(null::public.tareas,
--      (select datos from public.auditoria where id = 123));
--    (Igual para volantes/bitacora cambiando la tabla.)
--
--  Limpieza opcional (si algún día pesa; hoy no urge):
--    delete from public.auditoria where en < now() - interval '180 days';
-- =====================================================================
