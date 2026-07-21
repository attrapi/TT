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
       count(*) filter (where notif_visto_en is not null) as ya_leyeron_alguna_vez,
       count(*) as perfiles
from public.perfiles;
