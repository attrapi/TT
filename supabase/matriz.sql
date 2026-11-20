-- =====================================================================
--  TT · Matriz de Cumplimiento (PROTOTIPO)
--
--  El problema que resuelve: el seguimiento ambiental de SGOI-A no es una
--  lista, es una REJA. Renglon = la obligacion (Condicionante 3, ETJ,
--  Informe Mensual). Columna = el segmento (15-B, 16-17, 18-20, Estaciones,
--  Ed. Auxiliares). Celda = en que va esa obligacion EN ESE segmento.
--
--  Una tarea de TT no puede representar eso: tiene UN solo `estatus`, asi
--  que no puede decir "cumplida en 16-17, pendiente en 18-20". Por eso el
--  seguimiento se estaba migrando a una hoja de calculo:
--  https://docs.google.com/spreadsheets/d/1nIjObl24-d0L4GzvV71ta35c2aM-JgjlfFfvGIXl408
--
--  POR QUE TABLAS APARTE Y NO `tareas`:
--  son ~135 celdas. Si entraran como tareas, apareceran manana en el
--  tablero, en los conteos del menu y en Reportes de todo SGOI-A. Esto es
--  un prototipo: tiene que poderse ver sin mover nada de lo que ya usa el
--  equipo, y poderse borrar sin dejar rastro (drop de 3 tablas).
--  Cuando se apruebe, `matriz_celdas.tarea_id` amarra cada celda con su
--  tarea real de TT y la celda pasa a ser la vista de esa tarea.
--
--  ESTE ARCHIVO ES SOLO EL ESQUEMA: tablas vacias, ni un dato.
--  La carga inicial (los segmentos, las condicionantes y las 113 celdas con
--  su estatus y sus oficios) vive en dos archivos APARTE que NO van al
--  repo, porque este repo es PUBLICO:
--      supabase/matriz-seed.local.sql
--      supabase/matriz-celdas.local.sql
--  El .gitignore ya los excluye con la regla `*.local.sql`, la misma que se
--  usa para los demas borradores de SQL con datos del equipo. Es el estado
--  de cumplimiento de las MIA ante la DGIRA: que condicionante falta, en que
--  segmento, de que consorcio y con que numero de oficio. Eso no se publica
--  en GitHub. Se piden al usuario y se pegan a mano en el SQL Editor.
--
--  Pegar en: Supabase -> SQL Editor -> New query -> Run. Es idempotente.
-- =====================================================================

-- ---------- 1) SEGMENTOS (las columnas de la reja) ----------
-- Un segmento vive dentro de un proyecto (un tramo ferroviario de los que
-- ya estan en PROYECTOS_FASES, en index.html). El consorcio y el
-- cadenamiento son datos del segmento, no de la obligacion.
create table if not exists public.matriz_segmentos (
  clave        text primary key,          -- 'MN-18-20', 'SM-13-14'
  proyecto     text not null,             -- debe cuadrar con PROYECTOS_FASES
  nombre       text not null,             -- '18-20', 'ESTACIONES NORTE'
  consorcio    text not null default '',
  cadenamiento text not null default '',
  orden        int  not null default 0
);
create index if not exists matriz_segmentos_proy_idx
  on public.matriz_segmentos (proyecto, orden);

-- De quien es el segmento: 'SGOI' (SGOI-A), 'SGOIB' o 'SGOIC'. Son las mismas
-- claves que usa el resto de TT (perfiles.subdireccion y los tabs del
-- tablero), para no inventar un segundo vocabulario para lo mismo.
-- Va como ALTER y no dentro del CREATE porque `create table if not exists` no
-- toca una tabla que ya existe: asi el archivo sigue sirviendo para actualizar
-- una base que ya tiene la matriz cargada. El default deja en SGOI-A todo lo
-- que ya estaba, que es de donde salio.
alter table public.matriz_segmentos
  add column if not exists subdireccion text not null default 'SGOI';
create index if not exists matriz_segmentos_sub_idx
  on public.matriz_segmentos (subdireccion, proyecto, orden);

-- ---------- 2) REQUISITOS (los renglones de la reja) ----------
-- `padre`   : un sub-entregable cuelga de su condicionante. En la hoja esto
--             son los renglones de abajo sin etiqueta propia ("Primer
--             informe semestral", "Poliza", "2. Analisis posterior").
-- `familia` : la MISMA obligacion en distintos proyectos. Cada MIA tiene su
--             propia resolucion y su propia numeracion, pero "reforestacion
--             y rescate de flora" es la misma cosa en Saltillo-Monterrey y
--             en Monterrey-Nuevo Laredo. Esta columna es la que contesta
--             "esta condicionante tambien aplica a:".
create table if not exists public.matriz_requisitos (
  clave      text primary key,            -- 'MN-C07', 'MN-C03.2'
  proyecto   text not null,
  resolucion text not null default '',    -- numero de la resolucion de la DGIRA
  tipo       text not null default 'condicionante',  -- condicionante|termino|nota
  padre      text references public.matriz_requisitos(clave) on delete cascade,
  familia    text not null default '',
  titulo     text not null,               -- corto, para el renglon
  texto      text not null default '',    -- el texto completo de la MIA
  fundamento text not null default '',    -- 'Considerando 2 al 14'
  orden      int  not null default 0
);
create index if not exists matriz_requisitos_proy_idx
  on public.matriz_requisitos (proyecto, orden);
create index if not exists matriz_requisitos_fam_idx
  on public.matriz_requisitos (familia) where familia <> '';

-- ---------- 3) CELDAS (el cruce: obligacion x segmento) ----------
-- `estatus` es el semaforo de la reja. 'na' = la obligacion no aplica a ese
-- segmento (en la hoja se captura como "N/A"); se pinta gris y no cuenta
-- como pendiente. Una celda que NO existe es distinto: es hueco sin capturar.
create table if not exists public.matriz_celdas (
  id          bigint generated always as identity primary key,
  requisito   text not null references public.matriz_requisitos(clave) on delete cascade,
  segmento    text not null references public.matriz_segmentos(clave)  on delete cascade,
  estatus     text not null default 'pendiente',  -- al_dia|proceso|pendiente|na
  nota        text not null default '',           -- el texto tal cual de la celda
  oficios     jsonb not null default '[]',        -- numeros de oficio, p.ej. ['<oficio>/<anio>']
  adjuntos    jsonb not null default '[]',        -- [{nombre, url}]
  fecha       date,
  tarea_id    uuid references public.tareas(id) on delete set null,
  actualizado_por text not null default '',
  updated_at  timestamptz not null default now(),
  unique (requisito, segmento)
);
create index if not exists matriz_celdas_req_idx on public.matriz_celdas (requisito);
create index if not exists matriz_celdas_seg_idx on public.matriz_celdas (segmento);

create or replace function public.matriz_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_matriz_touch on public.matriz_celdas;
create trigger trg_matriz_touch before update on public.matriz_celdas
  for each row execute function public.matriz_touch();

-- ---------- SEGURIDAD ----------
-- Mismo criterio que el resto de TT (schema.sql): cualquiera con sesion
-- valida lee y gestiona; sin login no se entra.
alter table public.matriz_segmentos enable row level security;
alter table public.matriz_requisitos enable row level security;
alter table public.matriz_celdas     enable row level security;

drop policy if exists matriz_segmentos_all on public.matriz_segmentos;
create policy matriz_segmentos_all on public.matriz_segmentos
  for all to authenticated using (true) with check (true);
drop policy if exists matriz_requisitos_all on public.matriz_requisitos;
create policy matriz_requisitos_all on public.matriz_requisitos
  for all to authenticated using (true) with check (true);
drop policy if exists matriz_celdas_all on public.matriz_celdas;
create policy matriz_celdas_all on public.matriz_celdas
  for all to authenticated using (true) with check (true);

select 'matriz: tablas listas' as resultado;
