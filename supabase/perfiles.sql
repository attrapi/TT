-- =====================================================================
--  TT · Asignar rol/área a cada perfil
--  CORRER **DESPUÉS** de haber creado los usuarios en Authentication → Users.
--  El trigger ya creó un perfil por cada usuario; esto les pone su nombre, rol,
--  subdirección y jefatura correctos (emparejando por correo).
--  NOTA: los correos/nombres de abajo son de EJEMPLO (no se exponen datos reales
--  del personal en el repositorio). Reemplázalos por los reales antes de correr.
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================
update public.perfiles p set
  nombre       = v.nombre,
  rol          = v.rol,
  subdireccion = v.subdireccion,
  jefatura     = v.jefatura,
  activo       = true
from (values
  ('director@ejemplo.gob.mx',    'Director',                  'Director',   'DPAC',   ''),
  ('staff@ejemplo.gob.mx',       'Staff de Dirección',        'Capturista', 'ENLACE', ''),
  ('subdir.spac@ejemplo.gob.mx', 'Subdirector(a) SPAC',       'Capturista', 'SPAC',   ''),
  ('subdir.sa@ejemplo.gob.mx',   'Subdirector(a) SA',         'Capturista', 'SA',     ''),
  ('subdir.sgoi@ejemplo.gob.mx', 'Subdirector(a) SGOI',       'Capturista', 'SGOI',   ''),
  ('jefe.jdpc@ejemplo.gob.mx',   'Jefe(a) Procedimientos',    'Capturista', 'SPAC',   'PROCEDIMIENTOS'),
  ('jefe.jdima@ejemplo.gob.mx',  'Jefe(a) Manuales',          'Capturista', 'SPAC',   'MANUALES'),
  ('jefe.jdga@ejemplo.gob.mx',   'Jefe(a) Gestión Ambiental', 'Capturista', 'SGOI',   'GESTION_AMBIENTAL'),
  ('jefe.jdgoi@ejemplo.gob.mx',  'Jefe(a) Gestión Obras',     'Capturista', 'SGOI',   'GESTION_OBRAS')
) as v(email, nombre, rol, subdireccion, jefatura)
join auth.users u on lower(u.email) = lower(v.email)
where p.id = u.id;

-- Verificación: muestra cómo quedaron los perfiles.
select pf.nombre, pf.rol, pf.subdireccion, pf.jefatura, u.email
from public.perfiles pf join auth.users u on u.id = pf.id
order by pf.rol, pf.subdireccion;
