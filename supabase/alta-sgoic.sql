-- =====================================================================
--  TT · Perfiles del equipo de SGOI-C (subdirección + jefatura JDGA-C)
--
--  ESTADO: PENDIENTE de aplicar.
--
--  Estructura:
--    SGOI-C (subdirección)   → subdireccion='SGOIC', jefatura=''
--      └── JDGA-C (jefatura) → subdireccion='SGOIC', jefatura='GESTION_AMBIENTAL_C'
--
--  ⚠ EL CÓDIGO DE LA JEFATURA ES 'GESTION_AMBIENTAL_C', con la _C AL FINAL.
--  Sin la _C el sistema lo lee como la JDGA de SGOI-A (que es OTRA jefatura):
--  el usuario vería la columna equivocada y sus tareas nacerían con prefijo
--  JDGA- en vez de JDGAC-.
--
--  Alta de alguien nuevo aquí = 2 pasos:
--    1) Authentication → Users → Add user (marcar "Auto Confirm User").
--       El trigger handle_new_user le crea un perfil EN BLANCO, cuyo `nombre`
--       queda como su correo y su subdireccion vacía → sin tablero.
--    2) Correr el UPDATE de abajo con su correo real, para llenar ese perfil.
--
--  Los correos de abajo son PLACEHOLDERS: el repo es público y aquí no se
--  guardan datos reales del personal. Sustitúyelos antes de correr.
--  La copia con los correos reales vive fuera del repo, como
--  alta-sgoic-correos.local.sql (*.local.sql está en .gitignore).
--
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- 1) Subdirector de SGOI-C (nuevo) ----------
-- Ricardo Gallo Tovar. Rol 'Capturista' + jefatura vacía = subdirector: ve su
-- subdirección COMPLETA (incluida la JDGA-C) y valida las tareas de su jefatura.
update public.perfiles p set
  nombre       = v.nombre,
  rol          = v.rol,
  subdireccion = v.subdireccion,
  jefatura     = v.jefatura,
  es_enlace       = false,
  acceso_completo = false,
  activo       = true
from (values
  -- correo                          nombre completo         rol           sub      jefatura
  ('SUBDIRECTOR_SGOIC@ejemplo.com', 'Ricardo Gallo Tovar',  'Capturista', 'SGOIC', '')
) as v(email, nombre, rol, subdireccion, jefatura)
join auth.users u on lower(u.email) = lower(v.email)
where p.id = u.id;

-- ---------- 2) Jefatura JDGA-C (Imelda, que YA existe) ----------
-- Imelda NO se da de alta otra vez: solo se MUEVE de la JDGA de SGOI-A a la
-- JDGA-C de SGOI-C. Se identifica por su correo, no por el nombre.
update public.perfiles p set
  subdireccion = 'SGOIC',
  jefatura     = 'GESTION_AMBIENTAL_C'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('JEFA_JDGAC@ejemplo.com');

-- ---------- 3) OPCIONAL: sus tareas viejas ----------
-- Al mover el perfil, las tareas que Imelda ya tenía NO se mueven: siguen con
-- jefatura='GESTION_AMBIENTAL' y código JDGA-###, así que se quedan en el
-- tablero de SGOI-A. Es lo esperado (son historial de SGOI-A).
-- Si se decidiera pasarlas a SGOI-C, descomentar lo de abajo. OJO: el `codigo`
-- ya está congelado (JDGA-001…), no se renumera; solo cambia de tablero.
--
-- update public.tareas
--    set area = 'JDGAC', subdireccion = 'SGOIC', jefatura = 'GESTION_AMBIENTAL_C'
--  where nivel = 'jefatura' and jefatura = 'GESTION_AMBIENTAL'
--    and lower(responsable) like '%imelda%';

-- Verificación 1: cómo quedó el equipo de SGOI-C.
select pf.nombre, pf.rol, pf.subdireccion, pf.jefatura, u.email
from public.perfiles pf join auth.users u on u.id = pf.id
where pf.subdireccion = 'SGOIC'
order by pf.jefatura, pf.nombre;

-- Verificación 2: perfiles que quedaron SIN migrar (creados por el trigger y
-- nunca actualizados). Se reconocen porque su `nombre` es un correo o porque
-- no tienen subdirección. Si sale alguien aquí, no tiene tablero al entrar.
select pf.nombre, u.email, pf.subdireccion, pf.jefatura
from public.perfiles pf join auth.users u on u.id = pf.id
where pf.subdireccion = '' or pf.nombre like '%@%';
