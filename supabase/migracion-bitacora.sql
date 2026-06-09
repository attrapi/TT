-- =====================================================================
--  TT · Limpieza de bitácora (una sola vez)
--  Las acciones del CHECKLIST (agregar/quitar/editar una acción) se
--  guardaban con accion = 'mover', por lo que se mostraban como "Movida"
--  (parecía que alguien movía la tarjeta). Aquí se reetiquetan según el
--  marcador del comentario:  + agregada · − quitada · ✎ editada.
--
--  Solo afecta a las entradas de checklist (las que llevan ese marcador en
--  el comentario). Los movimientos REALES de tarjeta (accion 'mover' con
--  comentario vacío) NO se tocan.
--
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

update public.bitacora
   set accion = 'accion_add'
 where accion = 'mover' and comentario like '+%';

update public.bitacora
   set accion = 'accion_del'
 where accion = 'mover' and (comentario like '−%' or comentario like '-%');

update public.bitacora
   set accion = 'accion_edit'
 where accion = 'mover' and comentario like '✎%';

-- Verificación (opcional): cuántas quedaron por tipo.
-- select accion, count(*) from public.bitacora group by accion order by accion;
