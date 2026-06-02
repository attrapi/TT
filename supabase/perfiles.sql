-- =====================================================================
--  TT · Asignar rol/área a cada perfil
--  CORRER **DESPUÉS** de haber creado los 9 usuarios en Authentication → Users
--  (con los emails @attrapi.gob.mx indicados). El trigger ya creó un perfil por
--  cada usuario; esto les pone su nombre, rol, subdirección y jefatura correctos.
--  Pegar en: Supabase → SQL Editor → New query → Run.
-- =====================================================================
update public.perfiles p set
  nombre       = v.nombre,
  rol          = v.rol,
  subdireccion = v.subdireccion,
  jefatura     = v.jefatura,
  activo       = true
from (values
  ('adrian@attrapi.gob.mx',    'Ing. Adrián Tavares Echegaray',         'Director',   'DPAC',   ''),
  ('samanta@attrapi.gob.mx',   'Lic. Samantha Arechederra',             'Capturista', 'ENLACE', ''),
  ('mario@attrapi.gob.mx',     'Ing. Mario Alberto Ramírez Franca',     'Capturista', 'SPAC',   ''),
  ('amanda@attrapi.gob.mx',    'Lic. Amanda Atenea Tovar Pérez',        'Capturista', 'SA',     ''),
  ('fabiola@attrapi.gob.mx',   'Biol. Fabiola Atzyri Corella Vázquez',  'Capturista', 'SGOI',   ''),
  ('guillermo@attrapi.gob.mx', 'Arq. Luis Guillermo Favila Hernández',  'Capturista', 'SPAC',   'PROCEDIMIENTOS'),
  ('dolores@attrapi.gob.mx',   'Lic. Maria Dolores Carrasco Zamora',    'Capturista', 'SPAC',   'MANUALES'),
  ('imelda@attrapi.gob.mx',    'Ing. Imelda Rangel Rivera',             'Capturista', 'SGOI',   'GESTION_AMBIENTAL'),
  ('carolina@attrapi.gob.mx',  'Ing. Carolina Saldaña Balderrama',      'Capturista', 'SGOI',   'GESTION_OBRAS')
) as v(email, nombre, rol, subdireccion, jefatura)
join auth.users u on lower(u.email) = v.email
where p.id = u.id;

-- Verificación: muestra cómo quedaron los perfiles.
select pf.nombre, pf.rol, pf.subdireccion, pf.jefatura, u.email
from public.perfiles pf join auth.users u on u.id = pf.id
order by pf.rol, pf.subdireccion;
