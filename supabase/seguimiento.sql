-- =====================================================================
--  TT · Sesión de Seguimiento (repaso de tareas en junta)
--  El Director y los 3 subdirectores repasan las tareas en la sala de junta
--  y marcan cada una como "con seguimiento" (✓) con el acuerdo de la reunión.
--  El avance vive en la BASE (no en el navegador): sobrevive recargas y todos
--  ven lo mismo. El acuerdo además queda en la bitácora de la tarea.
--
--  "Con seguimiento en la sesión actual" = seguimiento_en NO es null. Al iniciar
--  una nueva sesión se limpia (botón "Reiniciar sesión" en la app).
--
--  Pegar en: Supabase → SQL Editor → New query → Run. Es idempotente.
-- =====================================================================

alter table public.tareas add column if not exists seguimiento_en      timestamptz;              -- cuándo se le dio seguimiento (null = pendiente)
alter table public.tareas add column if not exists seguimiento_por     text not null default ''; -- quién le dio seguimiento
alter table public.tareas add column if not exists seguimiento_acuerdo text not null default ''; -- acuerdo de la junta (última vez)

-- Verificación
select 'seguimiento listo' as resultado,
       count(*) filter (where seguimiento_en is not null) as con_seguimiento,
       count(*) as total
from public.tareas;
