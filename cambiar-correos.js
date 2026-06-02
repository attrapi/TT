/* ============================================================
 *  TT · Cambiar los correos de login en Supabase (Auth Admin API)
 *  Uso (en la terminal, dentro de esta carpeta):
 *      node cambiar-correos.js TU_SECRET_KEY
 *  La SECRET KEY la sacas de:
 *      Supabase → Project Settings → API Keys → "Secret" (sb_secret_...)
 *  (NO la pegues dentro del archivo; pásala como argumento para no guardarla.)
 * ============================================================ */
const SUPABASE_URL = 'https://cduqgcyktcruvxrmlkks.supabase.co';
const KEY = process.argv[2];
if (!KEY) {
  console.error('\nFalta la secret key.\nUso:  node cambiar-correos.js sb_secret_...\n');
  process.exit(1);
}

// viejo (actual en Supabase)  ->  nuevo (real)
const CAMBIOS = [
  ['adrian@attrapi.gob.mx',    'adrian.tavares@sict.gob.mx'],
  ['samanta@attrapi.gob.mx',   'samantha.arechederra@gmail.com'],
  ['mario@attrapi.gob.mx',     'mario@sict.gob.mx'],
  ['amanda@attrapi.gob.mx',    'amanda@sict.gob.mx'],
  ['fabiola@attrapi.gob.mx',   'fabiola.corella@sict.gob.mx'],
  ['guillermo@attrapi.gob.mx', 'luis.favila@sict.gob.mx'],
  ['dolores@attrapi.gob.mx',   'maria.carrasco@sict.gob.mx'],
  ['imelda@attrapi.gob.mx',    'imelda.rangel@sict.gob.mx'],
  ['carolina@attrapi.gob.mx',  'carolinasaldanab@outlook.com']
];

const H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function main() {
  // 1) Trae todos los usuarios.
  let users = [], page = 1;
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: H });
    if (!r.ok) { console.error('Error listando usuarios:', r.status, await r.text()); process.exit(1); }
    const data = await r.json();
    const arr = data.users || (Array.isArray(data) ? data : []);
    users = users.concat(arr);
    if (arr.length < 200) break;
    page++;
  }
  const porCorreo = {};
  users.forEach(u => { if (u.email) porCorreo[u.email.toLowerCase()] = u; });

  // 2) Cambia cada correo.
  for (const [viejo, nuevo] of CAMBIOS) {
    const u = porCorreo[viejo.toLowerCase()];
    if (!u) { console.log('—  no encontrado (¿ya cambiado?):', viejo); continue; }
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
      method: 'PUT', headers: H,
      body: JSON.stringify({ email: nuevo, email_confirm: true })
    });
    if (r.ok) console.log('✓', viejo, '→', nuevo);
    else      console.log('✗', viejo, '→', nuevo, '|', r.status, await r.text());
  }
  console.log('\nListo. Prueba el login con un correo nuevo.');
}
main().catch(e => { console.error(e); process.exit(1); });
