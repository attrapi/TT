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
--  ANTES de correr esto: Supabase → Authentication → Users → Add user para el
--  subdirector nuevo, con "Auto Confirm User" MARCADO. El trigger
--  handle_new_user le crea el perfil en blanco que aquí se llena. (La jefa de
--  JDGA-C ya existe en Auth: a ella solo se le cambia el perfil.)
--
--  Los correos de abajo son PLACEHOLDERS: el repo es público y aquí no se
--  guardan datos reales del personal. Sustitúyelos antes de correr, o usa la
--  copia local con los correos reales (*.local.sql, ignorada por git).
--
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- 1) Subdirector de SGOI-C (nuevo) ----------
-- Rol 'Capturista' + jefatura vacía = subdirector: ve su subdirección
-- COMPLETA (incluida la JDGA-C) y valida las tareas de esa jefatura.
update public.perfiles p set
  nombre          = 'Subdirector(a) de SGOI-C',
  rol             = 'Capturista',
  subdireccion    = 'SGOIC',
  jefatura        = '',
  es_enlace       = false,
  acceso_completo = false,
  activo          = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('SUBDIRECTOR_SGOIC@ejemplo.com');

-- ---------- 2) Jefatura JDGA-C: se MUEVE desde la JDGA de SGOI-A ----------
-- No se da de alta otra vez, solo cambia de área. Se identifica por su correo,
-- no por el nombre.
-- Esto es lo que hace que su menú deje de decir "SGOI-A" y la columna del
-- tablero deje de decir "JDGA": ambas etiquetas salen de este perfil.
update public.perfiles p set
  subdireccion = 'SGOIC',
  jefatura     = 'GESTION_AMBIENTAL_C'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('JEFA_JDGAC@ejemplo.com');

-- ---------- 3) OPCIONAL: sus tareas viejas ----------
-- Al mover el perfil, las tareas que ya tenía NO se mueven: siguen con
-- jefatura='GESTION_AMBIENTAL' y código JDGA-###, así que se quedan en el
-- tablero de SGOI-A. Es lo esperado (son historial de SGOI-A), pero ojo: ella
-- deja de verlas, porque un jefe solo ve las tareas de SU jefatura.
-- Si se decidiera pasarlas a SGOI-C, descomentar. OJO: el `codigo` ya está
-- congelado (JDGA-001…), no se renumera; solo cambia de tablero.
--
-- update public.tareas
--    set area = 'JDGAC', subdireccion = 'SGOIC', jefatura = 'GESTION_AMBIENTAL_C'
--  where nivel = 'jefatura' and jefatura = 'GESTION_AMBIENTAL'
--    and lower(responsable) like '%imelda%';

-- ---------- Verificación 1: cómo quedó el equipo de SGOI-C ----------
-- Deben salir DOS renglones: el subdirector con jefatura vacía y la jefa con
-- GESTION_AMBIENTAL_C. Si sale uno solo (o ninguno), el correo de ese no
-- coincide con ninguno en auth.users.
select pf.nombre, pf.rol, pf.subdireccion, pf.jefatura, u.email
from public.perfiles pf join auth.users u on u.id = pf.id
where pf.subdireccion = 'SGOIC'
order by pf.jefatura, pf.nombre;

-- ---------- Verificación 2: perfiles que quedaron SIN migrar ----------
-- Creados por el trigger y nunca actualizados. Se reconocen porque su `nombre`
-- es un correo o porque no tienen subdirección. Si sale alguien aquí, no tiene
-- tablero al entrar.
select pf.nombre, u.email, pf.subdireccion, pf.jefatura
from public.perfiles pf join auth.users u on u.id = pf.id
where pf.subdireccion = '' or pf.nombre like '%@%';

-- ---------- Deshacer el paso 2, si hiciera falta ----------
-- update public.perfiles p set subdireccion = 'SGOI', jefatura = 'GESTION_AMBIENTAL'
-- from auth.users u where p.id = u.id
--   and lower(u.email) = lower('JEFA_JDGAC@ejemplo.com');
