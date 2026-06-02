-- =====================================================================
--  TT · Asignar rol/área a cada perfil
--  CORRER **DESPUÉS** de haber creado los 9 usuarios en Authentication → Users
--  (con los correos institucionales indicados). El trigger ya creó un perfil por
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
  ('adrian.tavares@sict.gob.mx',     'Ing. Adrián Tavares Echegaray',         'Director',   'DPAC',   ''),
  ('samantha.arechederra@gmail.com', 'Lic. Samantha Arechederra',             'Capturista', 'ENLACE', ''),
  ('mario.ramirezf@sict.gob.mx',     'Ing. Mario Alberto Ramírez Franca',     'Capturista', 'SPAC',   ''),
  ('amanda.tovar@sict.gob.mx',       'Lic. Amanda Atenea Tovar Pérez',        'Capturista', 'SA',     ''),
  ('fabiola.corella@sict.gob.mx',    'Biol. Fabiola Atzyri Corella Vázquez',  'Capturista', 'SGOI',   ''),
  ('luis.favila@sict.gob.mx',        'Arq. Luis Guillermo Favila Hernández',  'Capturista', 'SPAC',   'PROCEDIMIENTOS'),
  ('maria.carrasco@sict.gob.mx',     'Lic. Maria Dolores Carrasco Zamora',    'Capturista', 'SPAC',   'MANUALES'),
  ('imelda.rangel@sict.gob.mx',      'Ing. Imelda Rangel Rivera',             'Capturista', 'SGOI',   'GESTION_AMBIENTAL'),
  ('carolinasaldanab@outlook.com',   'Ing. Carolina Saldaña Balderrama',      'Capturista', 'SGOI',   'GESTION_OBRAS')
) as v(email, nombre, rol, subdireccion, jefatura)
join auth.users u on lower(u.email) = lower(v.email)
where p.id = u.id;

-- Verificación: muestra cómo quedaron los perfiles.
select pf.nombre, pf.rol, pf.subdireccion, pf.jefatura, u.email
from public.perfiles pf join auth.users u on u.id = pf.id
order by pf.rol, pf.subdireccion;
