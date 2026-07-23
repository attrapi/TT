-- =====================================================================
--  TT · Progreso del juego "Reta a la Ley"
--  Guarda el avance de estudio de CADA usuario en SU cuenta, para que lo
--  siga en cualquier dispositivo (celular, otra compu, incógnito) y no se
--  pierda si se limpia la caché del navegador.
--
--  Una fila por usuario y por ley. Todo el detalle va en `datos` (jsonb):
--    { mejor, totalAciertos, totalFallos, partidas, rachaDiaria, ultimoDia,
--      preg:  { "<pregunta>": {v,a,f,n,ult,prox} },  -- memoria por pregunta
--      dias:  { "YYYY-MM-DD": {a,n} },               -- actividad diaria
--      partida: {...} }                              -- partida a medio jugar
--  Se usa jsonb (y no columnas) porque el juego irá creciendo: agregar un
--  dato nuevo no obliga a migrar la tabla.
--
--  La app sigue guardando en el navegador (localStorage) y sube aquí en
--  segundo plano: si no hay internet, se juega igual y sincroniza después.
--
--  Pegar en: Supabase → SQL Editor → New query → Run. Es idempotente.
-- =====================================================================

create table if not exists public.juego_progreso (
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  ley         text not null,                       -- 'lopsrm', 'laassp', ...
  datos       jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now(),
  primary key (usuario_id, ley)
);

alter table public.juego_progreso enable row level security;

-- Cada quien ve y escribe SOLO su propio avance. Nadie ve el de los demás.
drop policy if exists juego_progreso_leer on public.juego_progreso;
create policy juego_progreso_leer on public.juego_progreso
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists juego_progreso_insertar on public.juego_progreso;
create policy juego_progreso_insertar on public.juego_progreso
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists juego_progreso_actualizar on public.juego_progreso;
create policy juego_progreso_actualizar on public.juego_progreso
  for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Verificación
select 'juego listo' as resultado,
       (select count(*) from public.juego_progreso) as filas_de_avance;
