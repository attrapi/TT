-- =====================================================================
--  TT · Notificaciones en la app (campanita)
--  Las notificaciones NO se guardan una por una: se calculan en el
--  navegador a partir de la bitácora, que ya registra todo lo que pasa
--  (crear, accion_add, comentario, devolver, validar…) y ya llega en
--  tiempo real. Ver notificacionesDeUsuario() en index.html.
--
--  Lo único que hay que guardar es hasta dónde ya leyó cada quien, para
--  que el contador de "nuevas" siga a la persona y no al navegador: si
--  las lees en la compu, ya no te salen como nuevas en el teléfono.
--
--  Pegar en: Supabase → SQL Editor → New query → Run. Es idempotente.
-- =====================================================================

-- Cuáles notificaciones ya abrió (ids de la bitácora). Se guarda la LISTA y no
-- una fecha de corte: el contador tiene que bajar de una en una conforme se
-- abren, no marcarse todo leído por asomarse al panel.
alter table public.perfiles add column if not exists notif_leidas jsonb not null default '[]'::jsonb;

-- Columna de la primera versión (marca de tiempo). Ya no se usa; se deja para
-- no romper bases donde ya se creó.
alter table public.perfiles add column if not exists notif_visto_en timestamptz;

-- Cada quien actualiza SU marca de leído. La política de perfiles puede ser
-- restrictiva para otras columnas, así que se asegura que un usuario pueda
-- escribir su propia fila.
drop policy if exists perfiles_actualiza_propio on public.perfiles;
create policy perfiles_actualiza_propio on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Verificación
select 'notificaciones listo' as resultado,
       count(*) filter (where notif_leidas <> '[]'::jsonb) as perfiles_con_leidas,
       count(*) as perfiles
from public.perfiles;
