-- =====================================================================
--  TT · ALTA DE LAS JEFATURAS JDGOI-B (de SGOI-B) y JDGOI-C (de SGOI-C)
--
--  Estructura que queda:
--    SGOI-B (subdireccion='SGOIB')
--      ├── JDGA-B   → subdireccion='SGOIB', jefatura='GESTION_AMBIENTAL_B'
--      └── JDGOI-B  → subdireccion='SGOIB', jefatura='GESTION_OBRAS_B'   ← NUEVA
--    SGOI-C (subdireccion='SGOIC')
--      ├── JDGA-C   → subdireccion='SGOIC', jefatura='GESTION_AMBIENTAL_C'
--      └── JDGOI-C  → subdireccion='SGOIC', jefatura='GESTION_OBRAS_C'   ← NUEVA
--
--  ⚠ La _B / _C AL FINAL del código no es adorno. Sin ella el sistema lo lee
--  como la JDGOI de SGOI-A (que es OTRA jefatura): la persona vería la columna
--  equivocada y sus tareas nacerían con prefijo JDGOI- en vez de JDGOIB-.
--
--  ⚠ SIN CAMBIO DE ESQUEMA. `perfiles.jefatura` es texto libre y el prefijo del
--  ID se deriva del área, así que esto son PUROS perfiles. Este archivo existe
--  para dejar documentada la estructura.
--
--  ⚠ Este repo es PÚBLICO: aquí van correos PLACEHOLDER. Para correr de verdad,
--  copia a `alta-jdgoi-bc.local.sql` (*.local.sql está en .gitignore) con los
--  correos reales.
--
--  ANTES de correr esto: Supabase → Authentication → Users → Add user para
--  cada persona nueva, con "Auto Confirm User" MARCADO. El trigger
--  handle_new_user le crea el perfil en blanco que aquí se llena. (Si la
--  persona YA existe en Auth, solo se le cambia el perfil y no hay que darla
--  de alta otra vez.)
--
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- 1) Jefe(a) de la JDGOI-B (Obras Inducidas de SGOI-B) ----------
-- Rol 'Capturista' + jefatura NO vacía = jefe(a): ve SOLO su columna, y su
-- subdirectora de SGOI-B le valida.
update public.perfiles p set
  nombre          = 'NOMBRE COMPLETO JDGOI-B',
  rol             = 'Capturista',
  subdireccion    = 'SGOIB',
  jefatura        = 'GESTION_OBRAS_B',
  es_enlace       = false,
  acceso_completo = false,
  activo          = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('JEFE_JDGOIB@ejemplo.com');

-- ---------- 2) Jefe(a) de la JDGOI-C (Obras Inducidas de SGOI-C) ----------
update public.perfiles p set
  nombre          = 'NOMBRE COMPLETO JDGOI-C',
  rol             = 'Capturista',
  subdireccion    = 'SGOIC',
  jefatura        = 'GESTION_OBRAS_C',
  es_enlace       = false,
  acceso_completo = false,
  activo          = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('JEFE_JDGOIC@ejemplo.com');

-- ---------- Verificación ----------
-- Deben salir las jefaturas de cada letra con su código. Si a alguien le sale
-- `nombre` con forma de correo y `subdireccion` vacía, es un perfil recién
-- creado que NO se alcanzó a migrar (lo dejó así el trigger handle_new_user):
-- esa persona entra sin tablero hasta que se corra su update.
select pf.nombre, pf.rol, pf.subdireccion, pf.jefatura, u.email
from public.perfiles pf join auth.users u on u.id = pf.id
where pf.subdireccion in ('SGOIB', 'SGOIC')
order by pf.subdireccion, pf.jefatura, pf.nombre;

-- ---------- Nota sobre las tareas ya existentes ----------
-- Las tareas que hoy están a nivel subdirección (SGOIB-### / SGOIC-###) NO se
-- mueven solas a la jefatura nueva, y así debe ser. La subdirectora las reparte
-- ARRASTRANDO la tarjeta a la columna de su jefatura: eso agrega la jefatura
-- como participante (le da su columna de validación) sin renumerar el ID, que
-- ya está congelado.
