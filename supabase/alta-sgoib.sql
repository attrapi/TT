-- =====================================================================
--  TT · Perfiles del equipo de SGOI-B (subdirección + jefatura JDGA-B)
--
--  ESTADO: YA APLICADO (2026-08-07). Se deja como REFERENCIA para las
--  próximas altas de SGOI-B y como recordatorio del código de jefatura.
--
--  Estructura:
--    SGOI-B (subdirección)   → subdireccion='SGOIB', jefatura=''
--      └── JDGA-B (jefatura) → subdireccion='SGOIB', jefatura='GESTION_AMBIENTAL_B'
--
--  ⚠ EL CÓDIGO DE LA JEFATURA ES 'GESTION_AMBIENTAL_B', con la _B AL FINAL.
--  Sin la _B el sistema lo lee como la JDGA de SGOI-A (que es OTRA jefatura,
--  la de Imelda): el usuario vería la columna equivocada y sus tareas nacerían
--  con prefijo JDGA- en vez de JDGAB-.
--
--  Alta de alguien nuevo aquí = 2 pasos:
--    1) Authentication → Users → Add user (marcar "Auto Confirm User").
--       El trigger handle_new_user le crea un perfil EN BLANCO, cuyo `nombre`
--       queda como su correo y su subdireccion vacía → sin tablero.
--    2) Correr el UPDATE de abajo con su correo real, para llenar ese perfil.
--
--  Los correos de abajo son PLACEHOLDERS: el repo es público y aquí no se
--  guardan datos reales del personal. Sustitúyelos antes de correr.
--
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================
update public.perfiles p set
  nombre       = v.nombre,
  rol          = v.rol,
  subdireccion = v.subdireccion,
  jefatura     = v.jefatura,
  es_enlace       = false,
  acceso_completo = false,
  activo       = true
from (values
  -- correo                          nombre completo                rol           sub      jefatura
  ('SUBDIRECTOR_SGOIB@ejemplo.com', 'Subdirector(a) de SGOI-B',    'Capturista', 'SGOIB', ''),
  ('JEFE_JDGAB@ejemplo.com',        'Jefe(a) de JDGA-B',           'Capturista', 'SGOIB', 'GESTION_AMBIENTAL_B')
) as v(email, nombre, rol, subdireccion, jefatura)
join auth.users u on lower(u.email) = lower(v.email)
where p.id = u.id;

-- Verificación 1: cómo quedó el equipo de SGOI-B.
select pf.nombre, pf.rol, pf.subdireccion, pf.jefatura, u.email
from public.perfiles pf join auth.users u on u.id = pf.id
where pf.subdireccion = 'SGOIB'
order by pf.jefatura, pf.nombre;

-- Verificación 2: perfiles que quedaron SIN migrar (creados por el trigger y
-- nunca actualizados). Se reconocen porque su `nombre` es un correo o porque
-- no tienen subdirección. Si sale alguien aquí, no tiene tablero al entrar.
select pf.nombre, u.email, pf.subdireccion, pf.jefatura
from public.perfiles pf join auth.users u on u.id = pf.id
where pf.subdireccion = '' or pf.nombre like '%@%';
