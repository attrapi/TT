/**
 * TT · Backend de login y datos — Google Apps Script
 * ---------------------------------------------------
 * Hace tres cosas:
 *   1) Sirve la app (doGet) leyendo el index.html publicado en GitHub Pages,
 *      así no hay que copiar el HTML aquí: siempre sirve la última versión.
 *   2) Valida usuario/contraseña contra una hoja "Usuarios" (la lista de
 *      permitidos). Devuelve el rol y la subdirección de la persona.
 *   3) Entrega las tareas leyendo las hojas de SPAC del lado del servidor
 *      (las hojas pueden quedar PRIVADAS: ya no hace falta publicarlas).
 *
 * La app sigue funcionando en GitHub (modo demo con selección de perfil);
 * cuando se abre desde la URL del Web App de Apps Script, detecta que hay
 * sesión de servidor y muestra el login real.
 */

// ====================== CONFIGURACIÓN (rellena esto) ======================
// ⚙️ PASO ÚNICO: pon aquí tus datos y CORRE esta función una sola vez
//    (selecciona "guardarConfiguracion" arriba y pulsa Ejecutar ▶).
//    Queda guardada en las Propiedades del script. A partir de ahí puedes
//    re-pegar este código las veces que quieras y los IDs NO se borran.
//    Solo vuelve a correrla si quieres CAMBIAR algún dato.
function guardarConfiguracion() {
  var valores = {
    // ===== HOJAS — un archivo (Sheet) por área =====
    // Dirección (DPAC): tareas propias del Director.
    HOJA_DPAC_ID:    '1sBFNoqzlEVZMEZ5qUbzmUkJnmxxyfrKEt533ha-L6ME',
    HOJA_DPAC_PEST:  'DPAC',

    // Subdirección de Procesos Administrativos de Construcción (SPAC · Mario).
    // ESTE archivo aloja TAMBIÉN las pestañas Usuarios/Estados/Bitacora/Areas.
    HOJA_SPAC_ID:    '1jXNZwLW4NvChsf7Cn9TdODKksrRv3QqbwaKFKQceNBE',
    HOJA_SPAC_PEST:  'SPAC',

    // Jefatura de Procedimientos de Construcción (JDPC) — jefatura de SPAC.
    HOJA_JDPC_ID:    '19AYybHod11wkvSoIfv1r3W8Cogyrq_5nbch-kjy_d74',
    HOJA_JDPC_PEST:  'JDPC',

    // Jefatura de Implementación de Manuales Administrativos (JDIMA) — jefatura de SPAC.
    HOJA_JDIMA_ID:   '1HDMC0AwJYT7Br_JV5WqExpvdoMOF5tAip_ghu16MsS4',
    HOJA_JDIMA_PEST: 'JDIMA',

    // Subdirección de Gestión de Obras Inducidas (SGOI · Fabiola).
    HOJA_SGOI_ID:    '1bxbmxSaT-BU5-9_mkKCxVaLQFLie3MpTWTSk1qhLf9c',
    HOJA_SGOI_PEST:  'SGOI',

    // Jefatura de Gestión Ambiental (JDGA) — jefatura de SGOI.
    HOJA_JDGA_ID:    '1IfFKZr_JBTqJ5XNzw7Uevzb5-gAPOPLLXFibceHkZZU',
    HOJA_JDGA_PEST:  'JDGA',

    // Jefatura de Gestión de Obras Inducidas (JDGOI) — jefatura de SGOI.
    HOJA_JDGOI_ID:   '1ouEYN2YX63UtxEtGtkoMPRAkJZZmnI7n7Oo8AnCEOPw',
    HOJA_JDGOI_PEST: 'JDGOI',

    // Subdirección de Archivo (SA).
    HOJA_SA_ID:      '1JhYHSUSmSe0_yz0rJ6ijM8Y7uAm6AXzIxc2O8g_QqlQ',
    HOJA_SA_PEST:    'SA',

    // Staff del Director (antes "Enlace"). Captura tareas igual que una subdir.
    HOJA_STAFF_ID:   '13c7C4rkeMAN5TVfZSSsWhcyON3KrvzoAYi89v7NNsGE',
    HOJA_STAFF_PEST: 'STAFF',

    // Lista de login + pestañas de sistema (Estados/Bitacora/Areas). Vive en el
    // mismo archivo que SPAC.
    HOJA_USUARIOS_ID:   '1jXNZwLW4NvChsf7Cn9TdODKksrRv3QqbwaKFKQceNBE',
    HOJA_USUARIOS_PEST: 'Usuarios',

    APP_HTML_URL:       'https://attrapi.github.io/TT/index.html',
    HOJA_ESTADOS_PEST:  'Estados',

    // ===== CARPETAS DE DRIVE (adjuntos) — una por área =====
    // El adjunto se guarda en la carpeta del área de quien lo sube. La general
    // (DRIVE_CARPETA_ID) es el respaldo si un área no tiene carpeta propia.
    DRIVE_CARPETA_ID:    '1K9iW3yOVozBjJKQmi9_dOgTvNf7F7KAw',   // general (= DPAC)
    DRIVE_CARPETA_DPAC:  '1K9iW3yOVozBjJKQmi9_dOgTvNf7F7KAw',
    DRIVE_CARPETA_SPAC:  '19_RKC4qcix5bhWNMitT9-o-GEnpjPIsW',
    DRIVE_CARPETA_JDPC:  '1ZLSp0_JWdYZu0-6L4SiFDxTpewnaFc6t',
    DRIVE_CARPETA_JDIMA: '13jTWS3dTu-fFEh4w98Vk6IWhsVr1g6vG',
    DRIVE_CARPETA_SGOI:  '1RQY-EKlr0Hbzy7TKkuypBIINhrg3g2oZ',
    DRIVE_CARPETA_JDGA:  '1f5gO6VlSPxUOYo3_nM3MsMM3NDGYc5nD',
    DRIVE_CARPETA_JDGOI: '177G1h-8HEuQJYRecOKFGKSxfHAFLe836',
    DRIVE_CARPETA_SA:    '1QmUDp_bCYSOA0Cg73ghe7DbXWV2N1xQ3',
    DRIVE_CARPETA_STAFF: '1PCGU3TxYFPzkT2aiTCl9Hde4zByb1XhD',
    // Volantes (SGOI): los documentos adjuntos de los volantes van aquí.
    DRIVE_CARPETA_VOLANTES: '1ZyB40NrlKLVuKGlcX7cJ3iBRgVTpv5Av',
    HORAS_SESION:        '8'
  };
  // Solo guarda lo que SÍ llenaste: ignora los 'PEGA_AQUI...' para no borrar
  // configuración ya existente. Así re-correr esta función es seguro.
  var p = PropertiesService.getScriptProperties();
  // Si este proyecto reusó configuración del Drive ANTERIOR, borra esas claves
  // viejas para que no quede rastro del Drive pasado (estructura combinada y
  // Enlace ya no existen). Las claves nuevas se escriben justo debajo.
  var OBSOLETAS = ['HOJA_JEFATURAS_ID', 'HOJA_JEFATURAS_PEST', 'HOJA_SUBDIR_ID',
    'HOJA_SUBDIR_PEST', 'HOJA_ENLACE_ID', 'HOJA_ENLACE_PEST',
    'HOJA_SGOI_PEST_JDGA', 'HOJA_SGOI_PEST_JDGOI', 'DRIVE_CARPETA_ENLACE'];
  OBSOLETAS.forEach(function (k) { try { p.deleteProperty(k); } catch (e) {} });

  var aplicados = [];
  Object.keys(valores).forEach(function (k) {
    var v = String(valores[k]);
    if (v.indexOf('PEGA_AQUI') === 0) return;   // placeholder sin llenar → no tocar
    p.setProperty(k, v);
    aplicados.push(k);
  });
  Logger.log('✅ Guardado: ' + aplicados.join(', ') + '\n🧹 Limpiadas (Drive viejo): ' + OBSOLETAS.join(', '));
}

// ⚙️ Córrela UNA vez (Ejecutar ▶) para que Google pida autorizar TODOS los
//    permisos, incluido Drive (necesario para subir adjuntos). Acepta en el
//    diálogo. De paso verifica que la carpeta de Drive sea accesible.
function autorizar() {
  var carpeta = DriveApp.getFolderById(CONFIG.DRIVE_CARPETA_ID);
  // Crea y borra un archivo de prueba: esto OBLIGA a pedir el permiso de
  // ESCRITURA en Drive (subir archivos), no solo lectura.
  var prueba = carpeta.createFile('tt_prueba_permiso.txt', 'ok', 'text/plain');
  prueba.setTrashed(true);
  Logger.log('✅ Autorizado (lectura y escritura). Carpeta de adjuntos: "' + carpeta.getName() + '"');
}

// CONFIG se arma leyendo las Propiedades del script (lo que guardaste arriba).
// Así el código no contiene los IDs y re-pegarlo nunca los borra.
const CONFIG = (function () {
  var p = PropertiesService.getScriptProperties();
  function g(k, def) { var v = p.getProperty(k); return (v === null || v === '') ? (def || '') : v; }
  return {
    HOJA_DPAC_ID:        g('HOJA_DPAC_ID'),
    HOJA_DPAC_PEST:      g('HOJA_DPAC_PEST', 'DPAC'),
    HOJA_SPAC_ID:        g('HOJA_SPAC_ID'),
    HOJA_SPAC_PEST:      g('HOJA_SPAC_PEST', 'SPAC'),
    HOJA_JDPC_ID:        g('HOJA_JDPC_ID'),
    HOJA_JDPC_PEST:      g('HOJA_JDPC_PEST', 'JDPC'),
    HOJA_JDIMA_ID:       g('HOJA_JDIMA_ID'),
    HOJA_JDIMA_PEST:     g('HOJA_JDIMA_PEST', 'JDIMA'),
    HOJA_SGOI_ID:        g('HOJA_SGOI_ID'),
    HOJA_SGOI_PEST:      g('HOJA_SGOI_PEST', 'SGOI'),
    HOJA_JDGA_ID:        g('HOJA_JDGA_ID'),
    HOJA_JDGA_PEST:      g('HOJA_JDGA_PEST', 'JDGA'),
    HOJA_JDGOI_ID:       g('HOJA_JDGOI_ID'),
    HOJA_JDGOI_PEST:     g('HOJA_JDGOI_PEST', 'JDGOI'),
    HOJA_SA_ID:          g('HOJA_SA_ID'),
    HOJA_SA_PEST:        g('HOJA_SA_PEST', 'SA'),
    HOJA_STAFF_ID:       g('HOJA_STAFF_ID'),
    HOJA_STAFF_PEST:     g('HOJA_STAFF_PEST', 'STAFF'),
    HOJA_USUARIOS_ID:    g('HOJA_USUARIOS_ID'),
    HOJA_USUARIOS_PEST:  g('HOJA_USUARIOS_PEST', 'Usuarios'),
    APP_HTML_URL:        g('APP_HTML_URL', 'https://attrapi.github.io/TT/index.html'),
    HOJA_ESTADOS_PEST:   g('HOJA_ESTADOS_PEST', 'Estados'),
    DRIVE_CARPETA_ID:    g('DRIVE_CARPETA_ID'),
    DRIVE_CARPETA_DPAC:  g('DRIVE_CARPETA_DPAC'),
    DRIVE_CARPETA_SPAC:  g('DRIVE_CARPETA_SPAC'),
    DRIVE_CARPETA_JDPC:  g('DRIVE_CARPETA_JDPC'),
    DRIVE_CARPETA_JDIMA: g('DRIVE_CARPETA_JDIMA'),
    DRIVE_CARPETA_SGOI:  g('DRIVE_CARPETA_SGOI'),
    DRIVE_CARPETA_JDGA:  g('DRIVE_CARPETA_JDGA'),
    DRIVE_CARPETA_JDGOI: g('DRIVE_CARPETA_JDGOI'),
    DRIVE_CARPETA_SA:    g('DRIVE_CARPETA_SA'),
    DRIVE_CARPETA_STAFF: g('DRIVE_CARPETA_STAFF'),
    DRIVE_CARPETA_VOLANTES: g('DRIVE_CARPETA_VOLANTES'),
    HORAS_SESION:        Number(g('HORAS_SESION', '8'))
  };
})();
// ==========================================================================

// Limpia el caché del HTML para que la siguiente carga traiga la versión
// nueva de GitHub Pages. Ejecútalo manualmente cuando empujes cambios
// importantes y quieras que se reflejen en menos de 5 min.
function vaciarCacheHtml() {
  try { CacheService.getScriptCache().remove('idx_html_v1'); return 'OK'; }
  catch (e) { return 'Error: ' + e; }
}

// La app ya NO se sirve desde aquí (vive en GitHub Pages con Supabase). Este
// /exec se conserva solo para los ADJUNTOS (doPost). Si alguien abre el /exec
// viejo, lo redirigimos a la app nueva.
function doGet() {
  var destino = 'https://attrapi.github.io/TT/index.html';
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8">' +
    '<meta http-equiv="refresh" content="0; url=' + destino + '">' +
    '<script>try{top.location.href=' + JSON.stringify(destino) + ';}catch(e){location.href=' + JSON.stringify(destino) + ';}</script>' +
    '<p style="font-family:system-ui;padding:24px">Abriendo TT… ' +
    '<a href="' + destino + '" target="_top">haz clic aquí si no avanza</a>.</p>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============== doPost: ADJUNTOS para la versión Supabase ==============
// La app nueva (tt.html, servida por GitHub Pages) habla con Supabase para los
// datos, pero los ADJUNTOS siguen en Google Drive. Como el navegador no puede
// escribir en Drive directo, manda el archivo aquí por fetch y este doPost lo
// sube/borra usando la cuenta dueña del Drive. Devuelve JSON.
//   { accion:'subir',  nombre, mime, base64, destino }  -> { ok, url, nombre }
//   { accion:'borrar', url }                            -> { ok }
function doPost(e) {
  var out = { ok: false, error: 'Solicitud no reconocida.' };
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.accion === 'subir') {
      var carpetaId = carpetaDeArea_(req.destino) || CONFIG.DRIVE_CARPETA_ID;
      if (!carpetaId) { out = { ok: false, error: 'Falta configurar la carpeta de Drive.' }; }
      else {
        var bytes = Utilities.base64Decode(req.base64);
        var blob = Utilities.newBlob(bytes, req.mime || 'application/octet-stream', req.nombre || 'adjunto');
        var archivo = DriveApp.getFolderById(carpetaId).createFile(blob);
        try { archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {}
        out = { ok: true, url: archivo.getUrl(), nombre: archivo.getName() };
      }
    } else if (req.accion === 'borrar') {
      var id = idDeUrlDrive_(req.url);
      if (!id) { out = { ok: false, error: 'No se reconoció el archivo.' }; }
      else { DriveApp.getFileById(id).setTrashed(true); out = { ok: true }; }
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ============================== LOGIN =====================================
// Recibe usuario y contraseña; valida contra la hoja Usuarios. Devuelve un
// token de sesión (válido HORAS_SESION) y los datos del usuario.
function iniciarSesion(usuario, contrasena) {
  usuario = String(usuario || '').trim().toLowerCase();
  contrasena = String(contrasena || '');

  var filas = leerHoja_(CONFIG.HOJA_USUARIOS_ID, CONFIG.HOJA_USUARIOS_PEST);
  if (!filas.length) return { ok: false, error: 'No se pudo leer la lista de usuarios.' };

  var enc = filas[0].map(norm_);
  var iUser = enc.indexOf('usuario');
  var iPass = enc.indexOf('contrasena');           // "Contraseña" sin acento/may.
  var iNom  = enc.indexOf('nombre');
  var iRol  = enc.indexOf('rol');
  var iSub  = enc.indexOf('subdireccion');
  var iJef  = enc.indexOf('jefatura');
  var iAct  = enc.indexOf('activo');

  for (var r = 1; r < filas.length; r++) {
    var f = filas[r];
    if (String(f[iUser] || '').trim().toLowerCase() !== usuario) continue;
    if (iAct >= 0 && norm_(f[iAct]) === 'no') return { ok: false, error: 'Usuario inactivo.' };
    if (String(f[iPass]) !== contrasena) return { ok: false, error: 'Usuario o contraseña incorrectos.' };

    // Internamente solo existen 'Director' y 'Capturista'. Aceptamos los
    // términos humanos (Subdirector, Subdirección, etc.) y los mapeamos:
    // todo lo que no sea Director cuenta como Capturista (la pantalla mostrará
    // "Subdirector" o "Enlace" según la subdirección).
    var rol = (norm_(f[iRol]) === 'director') ? 'Director' : 'Capturista';
    var datos = {
      email: usuario,
      nombre: String(f[iNom] || '').trim(),
      rol: rol,
      subdireccion: String(f[iSub] || '').trim().toUpperCase(),
      jefatura: iJef >= 0 ? String(f[iJef] || '').trim() : ''
    };
    var token = Utilities.getUuid();
    CacheService.getScriptCache().put('tt_' + token, JSON.stringify(datos), CONFIG.HORAS_SESION * 3600);
    return { ok: true, token: token, usuario: datos };
  }
  return { ok: false, error: 'Usuario o contraseña incorrectos.' };
}

function cerrarSesion(token) {
  if (token) CacheService.getScriptCache().remove('tt_' + token);
  return { ok: true };
}

// Lista de usuarios ACTIVOS para pintar las tarjetas de "Ingresar como"
// (SIN contraseñas). Se llama antes de iniciar sesión.
function listarUsuarios() {
  var filas = leerHoja_(CONFIG.HOJA_USUARIOS_ID, CONFIG.HOJA_USUARIOS_PEST);
  if (!filas.length) return { ok: false, usuarios: [] };
  var enc = filas[0].map(norm_);
  var iUser = enc.indexOf('usuario'), iNom = enc.indexOf('nombre'),
      iRol = enc.indexOf('rol'), iSub = enc.indexOf('subdireccion'), iAct = enc.indexOf('activo');
  var out = [];
  for (var r = 1; r < filas.length; r++) {
    var f = filas[r];
    if (!String(f[iUser] || '').trim()) continue;
    if (iAct >= 0 && norm_(f[iAct]) === 'no') continue;
    out.push({
      usuario: String(f[iUser]).trim(),
      nombre: String(f[iNom] || '').trim(),
      rol: (norm_(f[iRol]) === 'director') ? 'Director' : 'Capturista',
      subdireccion: String(f[iSub] || '').trim().toUpperCase()
    });
  }
  return { ok: true, usuarios: out };
}

function sesionValida_(token) {
  if (!token) return null;
  var v = CacheService.getScriptCache().get('tt_' + token);
  return v ? JSON.parse(v) : null;
}

// Lista los nombres de los usuarios activos (subdirectoras, jefes y staff)
// para el autocompletado del campo "Responsable directo". Director excluido.
// Devuelve [{ nombreCompleto, primerosNombres, subdireccion, jefatura }].
function listarResponsables(token) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  try {
    var filas = leerHoja_(CONFIG.HOJA_USUARIOS_ID, CONFIG.HOJA_USUARIOS_PEST);
    if (!filas.length) return { ok: true, responsables: [] };
    var enc = filas[0].map(norm_);
    var iNom = enc.indexOf('nombre'),
        iRol = enc.indexOf('rol'),
        iSub = enc.indexOf('subdireccion'),
        iJef = enc.indexOf('jefatura'),
        iAct = enc.indexOf('activo');
    var out = [];
    for (var r = 1; r < filas.length; r++) {
      var f = filas[r];
      if (iAct >= 0 && norm_(f[iAct]) === 'no') continue;
      var rol = norm_(iRol >= 0 ? f[iRol] : '');
      if (rol === 'director') continue;  // Adrián no se autosugiere
      var nombre = String(iNom >= 0 ? (f[iNom] || '') : '').trim();
      if (!nombre) continue;
      out.push({
        nombreCompleto: nombre,
        subdireccion: String(iSub >= 0 ? (f[iSub] || '') : '').trim().toUpperCase(),
        jefatura: String(iJef >= 0 ? (f[iJef] || '') : '').trim()
      });
    }
    return { ok: true, responsables: out };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

// Mapa de teléfonos por (subdirección + jefatura) para mandar WhatsApp al
// responsable correcto desde la app. Lee la columna "Telefono" de Usuarios.
// Devuelve { ok: true, telefonos: { "SPAC|": "521234567890", ... } }.
function listarTelefonos(token) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  try {
    var filas = leerHoja_(CONFIG.HOJA_USUARIOS_ID, CONFIG.HOJA_USUARIOS_PEST);
    if (!filas.length) return { ok: true, telefonos: {} };
    var enc = filas[0].map(norm_);
    var iSub = enc.indexOf('subdireccion'),
        iJef = enc.indexOf('jefatura'),
        iTel = enc.indexOf('telefono'),
        iAct = enc.indexOf('activo'),
        iNom = enc.indexOf('nombre');
    if (iTel < 0) return { ok: true, telefonos: {} };   // columna aún no existe
    var map = {};
    for (var r = 1; r < filas.length; r++) {
      var f = filas[r];
      if (iAct >= 0 && norm_(f[iAct]) === 'no') continue;
      var sub = String(iSub >= 0 ? (f[iSub] || '') : '').trim().toUpperCase();
      var jef = String(iJef >= 0 ? (f[iJef] || '') : '').trim().toUpperCase();
      var tel = String(f[iTel] || '').trim();
      var nom = String(iNom >= 0 ? (f[iNom] || '') : '').trim();
      if (!tel) continue;
      // Normaliza: deja solo dígitos y, si falta lada México, antepone 521.
      var soloDigitos = tel.replace(/[^0-9]/g, '');
      if (soloDigitos.length === 10) soloDigitos = '521' + soloDigitos;
      map[sub + '|' + jef] = { telefono: soloDigitos, nombre: nom };
    }
    return { ok: true, telefonos: map };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

// Reanuda una sesión guardada en el navegador (para que recargar la página no
// cierre sesión). Devuelve el usuario si el token sigue vigente y renueva su TTL.
function reanudarSesion(token) {
  var datos = sesionValida_(token);
  if (!datos) return { ok: false };
  try { CacheService.getScriptCache().put('tt_' + token, JSON.stringify(datos), CONFIG.HORAS_SESION * 3600); } catch (e) {}
  return { ok: true, token: token, usuario: datos };
}

// ============================== DATOS =====================================
// Devuelve TODAS las tareas de SPAC (jefaturas + subdirección) ya parseadas,
// solo si el token de sesión es válido.
function obtenerTareas(token) {
  if (!sesionValida_(token)) return { ok: false, error: 'Sesión no válida. Vuelve a iniciar sesión.' };
  // Caché de ~30 s: si varias cargas (o varios usuarios) piden las tareas seguido,
  // se devuelven al instante en vez de releer las 9 hojas. Se INVALIDA en cuanto
  // alguien crea/edita/elimina/valida/mueve (invalidarCacheTareas_), así nadie ve
  // datos viejos por sus propios cambios.
  var cache = CacheService.getScriptCache();
  var hit = cache.get('tt_tareas_v1');
  if (hit) { try { return { ok: true, tareas: JSON.parse(hit) }; } catch (eC) { /* caché corrupta: recalcula */ } }

  var tareas = [];
  // Cada área es su propio archivo. Se lee de forma independiente: si una hoja
  // aún no está lista, se ignora y las demás siguen cargando.
  // [ID hoja, pestaña, nivel, subCode, jefatura forzada (o null) ]
  var FUENTES = [
    [CONFIG.HOJA_DPAC_ID,  CONFIG.HOJA_DPAC_PEST,  'subdireccion', 'DPAC',  null],
    [CONFIG.HOJA_SPAC_ID,  CONFIG.HOJA_SPAC_PEST,  'subdireccion', 'SPAC',  null],
    [CONFIG.HOJA_JDPC_ID,  CONFIG.HOJA_JDPC_PEST,  'jefatura',     'SPAC',  'PROCEDIMIENTOS'],
    [CONFIG.HOJA_JDIMA_ID, CONFIG.HOJA_JDIMA_PEST, 'jefatura',     'SPAC',  'MANUALES'],
    [CONFIG.HOJA_SGOI_ID,  CONFIG.HOJA_SGOI_PEST,  'subdireccion', 'SGOI',  null],
    [CONFIG.HOJA_JDGA_ID,  CONFIG.HOJA_JDGA_PEST,  'jefatura',     'SGOI',  'GESTION_AMBIENTAL'],
    [CONFIG.HOJA_JDGOI_ID, CONFIG.HOJA_JDGOI_PEST, 'jefatura',     'SGOI',  'GESTION_OBRAS'],
    [CONFIG.HOJA_SA_ID,    CONFIG.HOJA_SA_PEST,    'subdireccion', 'SA',    null],
    // Staff: archivo "STAFF", pero código interno 'ENLACE' (el que ya usa el front).
    [CONFIG.HOJA_STAFF_ID, CONFIG.HOJA_STAFF_PEST, 'subdireccion', 'ENLACE', null]
  ];
  FUENTES.forEach(function (f) {
    if (!f[0]) return;   // hoja sin configurar
    try {
      tareas = tareas.concat(parsearHoja_(leerHoja_(f[0], f[1]), f[2], f[3], f[4]));
    } catch (e) { /* hoja aún no lista o sin acceso: se ignora */ }
  });
  aplicarEstados_(tareas);   // combina con los avances guardados (hoja Estados)
  try { cache.put('tt_tareas_v1', JSON.stringify(tareas), 30); } catch (ePut) { /* >100KB: se sirve sin caché */ }
  return { ok: true, tareas: tareas };
}

// Borra la caché de tareas para que la próxima lectura traiga datos frescos. Se
// llama tras CUALQUIER escritura (crear/editar/eliminar/validar/mover/estado).
function invalidarCacheTareas_() {
  try { CacheService.getScriptCache().remove('tt_tareas_v1'); } catch (e) {}
}

// ============== MIGRACIÓN A SUPABASE (uso único) ==============
// Lee TODAS las tareas (9 hojas + avances de Estados) y genera el SQL de carga
// para Supabase. Deja un archivo .sql en tu Drive y te da el enlace en el log.
// Córrela desde el editor (selecciona exportarSqlSupabase → Ejecutar ▶) y abre
// el enlace que salga en "Registro de ejecución".
function exportarSqlSupabase() {
  // 1) Arma las tareas con la MISMA lógica de la app (parseo + merge de Estados).
  var FUENTES = [
    [CONFIG.HOJA_DPAC_ID,  CONFIG.HOJA_DPAC_PEST,  'subdireccion', 'DPAC',  null],
    [CONFIG.HOJA_SPAC_ID,  CONFIG.HOJA_SPAC_PEST,  'subdireccion', 'SPAC',  null],
    [CONFIG.HOJA_JDPC_ID,  CONFIG.HOJA_JDPC_PEST,  'jefatura',     'SPAC',  'PROCEDIMIENTOS'],
    [CONFIG.HOJA_JDIMA_ID, CONFIG.HOJA_JDIMA_PEST, 'jefatura',     'SPAC',  'MANUALES'],
    [CONFIG.HOJA_SGOI_ID,  CONFIG.HOJA_SGOI_PEST,  'subdireccion', 'SGOI',  null],
    [CONFIG.HOJA_JDGA_ID,  CONFIG.HOJA_JDGA_PEST,  'jefatura',     'SGOI',  'GESTION_AMBIENTAL'],
    [CONFIG.HOJA_JDGOI_ID, CONFIG.HOJA_JDGOI_PEST, 'jefatura',     'SGOI',  'GESTION_OBRAS'],
    [CONFIG.HOJA_SA_ID,    CONFIG.HOJA_SA_PEST,    'subdireccion', 'SA',    null],
    [CONFIG.HOJA_STAFF_ID, CONFIG.HOJA_STAFF_PEST, 'subdireccion', 'ENLACE', null]
  ];
  var tareas = [];
  FUENTES.forEach(function (f) {
    if (!f[0]) return;
    try { tareas = tareas.concat(parsearHoja_(leerHoja_(f[0], f[1]), f[2], f[3], f[4])); } catch (e) {}
  });
  aplicarEstados_(tareas);

  // 2) Helpers de SQL.
  function sq(v) { return "'" + String(v == null ? '' : v).replace(/'/g, "''") + "'"; }
  function sb(b) { return b ? 'true' : 'false'; }
  function sfecha(f) { f = String(f || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(f) ? "'" + f + "'" : 'NULL'; }
  function areaDe(t) {
    if (t.nivel === 'jefatura') {
      var j = String(t.jefatura || '').toUpperCase();
      return ({ PROCEDIMIENTOS: 'JDPC', MANUALES: 'JDIMA', GESTION_AMBIENTAL: 'JDGA', GESTION_OBRAS: 'JDGOI' })[j] || 'JDPC';
    }
    return String(t.subdireccion || '').toUpperCase();
  }

  var cols = '(codigo, area, subdireccion, nivel, jefatura, responsable, tema, areas_involucradas, ' +
             'acuerdos, accion, fecha, permanente, estatus, url, checklist, observaciones_resp, ' +
             'observaciones_dir, validada, en_validadas, confirmada, validado_por, fecha_validacion, ' +
             'finalizado_por, fecha_finalizacion, enviado_por, fecha_envio, eliminada, eliminado_por, ' +
             'fecha_eliminacion, creado_por)';

  var filas = tareas.map(function (t) {
    var chk = JSON.stringify(Array.isArray(t.checklist) ? t.checklist : []);
    return '(' + [
      sq(t.id), sq(areaDe(t)), sq(t.subdireccion), sq(t.nivel), sq(t.jefatura),
      sq(t.responsable), sq(t.tema), sq(t.areas_involucradas),
      sq(t.acuerdos_realizados), sq(t.accion_a_tomar),
      sfecha(t.fecha_atencion), sb(t.permanente), sq(t.estatus), sq(t.url),
      sq(chk) + '::jsonb', sq(t.observaciones_resp), sq(t.observaciones_dir),
      sb(t.validada), sb(t.en_validadas), sb(t.confirmada),
      sq(t.validado_por), sq(t.fecha_validacion), sq(t.finalizado_por), sq(t.fecha_finalizacion),
      sq(t.enviado_por), sq(t.fecha_envio), sb(t.eliminada), sq(t.eliminado_por),
      sq(t.fecha_eliminacion), sq(t.creado_por)
    ].join(', ') + ')';
  });

  var sql = '-- TT · Carga de tareas a Supabase (' + tareas.length + ' tareas)\n' +
            '-- Pega TODO en Supabase → SQL Editor → Run. Re-correrlo es seguro (no duplica).\n' +
            'insert into public.tareas ' + cols + ' values\n' +
            filas.join(',\n') + '\n' +
            'on conflict (codigo) do nothing;\n';

  // 3) Guarda el SQL como archivo en Drive y devuelve el enlace.
  var archivo = DriveApp.createFile('tt_carga_supabase.sql', sql, 'text/plain');
  try { archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  Logger.log('✅ ' + tareas.length + ' tareas. Abre este archivo, copia TODO y pégalo en Supabase:\n' + archivo.getUrl());
  return archivo.getUrl();
}

// Crea una tarea NUEVA escribiendo una fila en la hoja que corresponde.
// `datos`: { subdireccion, nivel, responsable, jefatura, tema, areas,
//            acuerdos, accion, fecha (yyyy-mm-dd o 'PERMANENTE'), url }
function crearTarea(token, datos) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  datos = datos || {};
  var sub = String(datos.subdireccion || '').toUpperCase();
  var esJef = datos.nivel === 'jefatura';

  // Cada área es su propio archivo. Si es jefatura, manda a la hoja de esa
  // jefatura (sin importar la subdirección); si no, a la hoja de la subdir.
  var destino = esJef ? hojaDeJefatura_(datos.jefatura) : hojaDeSubdir_(sub);
  if (!destino) return { ok: false, error: 'Aún no hay una hoja configurada para ' + (esJef ? ('la jefatura ' + datos.jefatura) : ('la subdirección ' + sub)) + '.' };
  var sheetId = destino.sheetId, sheetPest = destino.sheetPest;

  var hoja = obtenerHojaEscritura_(sheetId, sheetPest);
  if (!hoja) return { ok: false, error: 'No existe ninguna pestaña en la hoja destino.' };

  // Candado: serializa la asignación de ID + escritura para que dos creaciones
  // casi simultáneas (doble clic o reintento por internet) NO generen el mismo
  // ID dos veces. La 2a espera, lee la hoja YA actualizada y toma el ID siguiente.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (eLock) { return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' }; }

  var nuevoId, estIni;
  try {
    var valores = hoja.getDataRange().getValues();
    var e = -1;
    for (var i = 0; i < valores.length; i++) { if (norm_(valores[i][0]) === 'id') { e = i; break; } }
    if (e < 0) return { ok: false, error: 'No se encontró el encabezado (ID) en la hoja.' };

    var enc = valores[e].map(norm_);
    var fila = [];
    for (var c = 0; c < enc.length; c++) fila.push('');
    var set = function (nombre, val) {
      var idx = enc.indexOf(nombre);
      if (idx < 0) idx = enc.findIndex(function (h) { return h.indexOf(nombre) >= 0; });
      if (idx >= 0) fila[idx] = val;
    };
    // Fecha: la app manda yyyy-mm-dd; la hoja usa dd/mm/yyyy.
    var fecha = String(datos.fecha || '');
    var mm = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mm) fecha = mm[3] + '/' + mm[2] + '/' + mm[1];

    nuevoId = siguienteIdSheet_(valores, e, esJef ? prefijoJef_(datos.jefatura) : (sub + '-'));
    set('id', nuevoId);   // ID FIJO
    set('responsable', datos.responsable || '');
    if (esJef) set('jefatura', datos.jefatura || '');
    set('tema', datos.tema || '');
    set('areas', datos.areas || '');
    set('acuerdos realizados', datos.acuerdos || '');
    set('accion', datos.accion || '');
    set('fecha', fecha);
    // Estatus inicial: jefatura y tareas propias del Director (DPAC) nacen "En
    // Proceso"; las demás subdirecciones en "Para validar" (Atendida, retenida).
    estIni = estatusInicial_(datos.nivel, sub);
    set('estatus', estIni);
    set('url', datos.url || '');

    hoja.appendRow(fila);
    SpreadsheetApp.flush();   // confirma la escritura ANTES de soltar el candado
  } finally {
    lock.releaseLock();
  }

  agregarAreas_(datos.areas);   // registra áreas nuevas (las escritas en "Otra")

  // Seguimiento: guarda QUIÉN creó la tarea (hoja Estados) y déjalo en bitácora.
  var autor = sesion.nombre || sesion.email || '';
  var stamp = ahoraStamp_();
  try { guardarEstado(token, nuevoId, { creado_por: autor, fecha_creacion: stamp }); } catch (e2) {}
  try { registrarBitacora(token, { fecha: stamp, usuario: autor, accion: 'crear', id_tarea: nuevoId, estatus_anterior: '—', estatus_nuevo: estIni }); } catch (e3) {}

  invalidarCacheTareas_();
  return { ok: true, id: nuevoId };
}

// Siguiente ID estable para una hoja (máximo sufijo del prefijo + 1).
function siguienteIdSheet_(valores, e, prefijo) {
  var max = 0;
  for (var r = e + 1; r < valores.length; r++) {
    var v = String(valores[r][0] || '').trim();
    if (v.indexOf(prefijo) === 0) {
      var n = parseInt(v.slice(prefijo.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return prefijo + String(max + 1).padStart(3, '0');
}

// Localiza la fila (1-based en la hoja) de una tarea por su ID. Primero busca
// en la columna ID; si no, usa el respaldo posicional (ids viejos).
function localizarFila_(valores, e, id) {
  id = String(id || '').trim();
  for (var r = e + 1; r < valores.length; r++) {
    if (String(valores[r][0] || '').trim() === id) return r + 1;
  }
  var m = id.match(/-(\d+)$/);
  if (m) {
    var fila = e + parseInt(m[1], 10) + 1;
    if (fila > e + 1 && fila <= valores.length) return fila;
  }
  return -1;
}

// Asigna IDs fijos a las filas que aún no lo tienen (córrela UNA vez por área
// para migrar las tareas existentes). Recorre TODOS los archivos: a cada fila
// con "tema" pero sin ID estable le pone el prefijo de su área (DPAC-, SPAC-,
// JDPC-, JDIMA-, SGOI-, JDGA-, JDGOI-, SA-, STAFF-). Después, crear/editar/
// eliminar usan ese ID. Re-correrla es seguro (las que ya tienen ID se saltan).
function asignarIds() {
  var FUENTES = [
    [CONFIG.HOJA_DPAC_ID,  CONFIG.HOJA_DPAC_PEST,  'DPAC-'],
    [CONFIG.HOJA_SPAC_ID,  CONFIG.HOJA_SPAC_PEST,  'SPAC-'],
    [CONFIG.HOJA_JDPC_ID,  CONFIG.HOJA_JDPC_PEST,  'JDPC-'],
    [CONFIG.HOJA_JDIMA_ID, CONFIG.HOJA_JDIMA_PEST, 'JDIMA-'],
    [CONFIG.HOJA_SGOI_ID,  CONFIG.HOJA_SGOI_PEST,  'SGOI-'],
    [CONFIG.HOJA_JDGA_ID,  CONFIG.HOJA_JDGA_PEST,  'JDGA-'],
    [CONFIG.HOJA_JDGOI_ID, CONFIG.HOJA_JDGOI_PEST, 'JDGOI-'],
    [CONFIG.HOJA_SA_ID,    CONFIG.HOJA_SA_PEST,    'SA-'],
    [CONFIG.HOJA_STAFF_ID, CONFIG.HOJA_STAFF_PEST, 'ENLACE-']
  ];
  var hechos = 0, detalle = [];
  FUENTES.forEach(function (h) {
    if (!h[0]) return;   // área sin configurar
    var hoja;
    try { var ss = SpreadsheetApp.openById(h[0]); hoja = ss.getSheetByName(h[1]) || ss.getSheets()[0]; }
    catch (e0) { return; }
    if (!hoja) return;
    var vals = hoja.getDataRange().getValues();
    var e = -1;
    for (var i = 0; i < vals.length; i++) { if (norm_(vals[i][0]) === 'id') { e = i; break; } }
    if (e < 0) return;
    var iTema = vals[e].map(norm_).indexOf('tema');
    var max = 0;
    for (var r = e + 1; r < vals.length; r++) {
      var v = String(vals[r][0] || '').trim();
      if (v.indexOf(h[2]) === 0) { var n = parseInt(v.slice(h[2].length), 10); if (!isNaN(n) && n > max) max = n; }
    }
    var enArea = 0;
    for (var r2 = e + 1; r2 < vals.length; r2++) {
      if (iTema >= 0 && !String(vals[r2][iTema] || '').trim()) continue;     // fila vacía
      if (RE_ID_ESTABLE.test(String(vals[r2][0] || '').trim())) continue;    // ya tiene ID estable
      max++;
      hoja.getRange(r2 + 1, 1).setValue(h[2] + String(max).padStart(3, '0'));
      hechos++; enArea++;
    }
    detalle.push(h[2] + ' +' + enArea + ' (hasta ' + h[2] + String(max).padStart(3, '0') + ')');
  });
  Logger.log('✅ IDs fijos asignados: ' + hechos + '\n' + detalle.join('\n'));
  return { ok: true, asignados: hechos, detalle: detalle };
}

// Reemplaza, en la columna `colIdx` (0-based) de `hoja`, los valores presentes
// en `mapa` (viejo -> nuevo). Devuelve cuántas celdas cambió.
function renombrarEnHoja_(hoja, colIdx, mapa) {
  if (!hoja) return 0;
  var datos = hoja.getDataRange().getValues();
  var n = 0;
  for (var r = 1; r < datos.length; r++) {
    var v = String(datos[r][colIdx] || '').trim();
    if (mapa[v]) { hoja.getRange(r + 1, colIdx + 1).setValue(mapa[v]); n++; }
  }
  return n;
}

// Determina a qué hoja pertenece un ID y la subdirección dueña.
function hojaDeId_(id) {
  id = String(id || '').trim();
  // Jefaturas — cada una su propio archivo. JDGOI debe probarse antes que JDGA
  // no es necesario (prefijos distintos), pero el orden es claro de leer.
  if (/^JDPC-/i.test(id)  && CONFIG.HOJA_JDPC_ID)  return { sheetId: CONFIG.HOJA_JDPC_ID,  sheetPest: CONFIG.HOJA_JDPC_PEST,  sub: 'SPAC', esJef: true, jefatura: 'PROCEDIMIENTOS' };
  if (/^JDIMA-/i.test(id) && CONFIG.HOJA_JDIMA_ID) return { sheetId: CONFIG.HOJA_JDIMA_ID, sheetPest: CONFIG.HOJA_JDIMA_PEST, sub: 'SPAC', esJef: true, jefatura: 'MANUALES' };
  if (/^JDGOI-/i.test(id) && CONFIG.HOJA_JDGOI_ID) return { sheetId: CONFIG.HOJA_JDGOI_ID, sheetPest: CONFIG.HOJA_JDGOI_PEST, sub: 'SGOI', esJef: true, jefatura: 'GESTION_OBRAS' };
  if (/^JDGA-/i.test(id)  && CONFIG.HOJA_JDGA_ID)  return { sheetId: CONFIG.HOJA_JDGA_ID,  sheetPest: CONFIG.HOJA_JDGA_PEST,  sub: 'SGOI', esJef: true, jefatura: 'GESTION_AMBIENTAL' };
  // IDs viejos de jefatura de SPAC (archivo central) → ahora caen en JDPC.
  if (/^(?:JSPAC|SPACJ)-/i.test(id) && CONFIG.HOJA_JDPC_ID) return { sheetId: CONFIG.HOJA_JDPC_ID, sheetPest: CONFIG.HOJA_JDPC_PEST, sub: 'SPAC', esJef: true, jefatura: 'PROCEDIMIENTOS' };
  // Subdirecciones.
  if (/^SPAC-/i.test(id)  && CONFIG.HOJA_SPAC_ID)  return { sheetId: CONFIG.HOJA_SPAC_ID, sheetPest: CONFIG.HOJA_SPAC_PEST, sub: 'SPAC', esJef: false };
  if (/^DPAC-/i.test(id)  && CONFIG.HOJA_DPAC_ID)  return { sheetId: CONFIG.HOJA_DPAC_ID, sheetPest: CONFIG.HOJA_DPAC_PEST, sub: 'DPAC', esJef: false };
  if (/^SGOI-/i.test(id)  && CONFIG.HOJA_SGOI_ID)  return { sheetId: CONFIG.HOJA_SGOI_ID, sheetPest: CONFIG.HOJA_SGOI_PEST, sub: 'SGOI', esJef: false };
  if (/^SA-/i.test(id)    && CONFIG.HOJA_SA_ID)    return { sheetId: CONFIG.HOJA_SA_ID,   sheetPest: CONFIG.HOJA_SA_PEST,   sub: 'SA',   esJef: false };
  // Staff (archivo "STAFF"): el código interno sigue siendo 'ENLACE' (lo que el
  // front entiende). Reconoce ambos prefijos de ID por compatibilidad.
  if (/^(?:STAFF|ENLACE)-/i.test(id) && CONFIG.HOJA_STAFF_ID) return { sheetId: CONFIG.HOJA_STAFF_ID, sheetPest: CONFIG.HOJA_STAFF_PEST, sub: 'ENLACE', esJef: false };
  return null;
}

// Destino de escritura de una SUBDIRECCIÓN (su propio archivo). null si no hay.
function hojaDeSubdir_(sub) {
  sub = String(sub || '').toUpperCase();
  if (sub === 'SPAC' && CONFIG.HOJA_SPAC_ID) return { sheetId: CONFIG.HOJA_SPAC_ID, sheetPest: CONFIG.HOJA_SPAC_PEST, sub: 'SPAC', esJef: false };
  if (sub === 'DPAC' && CONFIG.HOJA_DPAC_ID) return { sheetId: CONFIG.HOJA_DPAC_ID, sheetPest: CONFIG.HOJA_DPAC_PEST, sub: 'DPAC', esJef: false };
  if (sub === 'SGOI' && CONFIG.HOJA_SGOI_ID) return { sheetId: CONFIG.HOJA_SGOI_ID, sheetPest: CONFIG.HOJA_SGOI_PEST, sub: 'SGOI', esJef: false };
  if (sub === 'SA'   && CONFIG.HOJA_SA_ID)   return { sheetId: CONFIG.HOJA_SA_ID,   sheetPest: CONFIG.HOJA_SA_PEST,   sub: 'SA',   esJef: false };
  if ((sub === 'STAFF' || sub === 'ENLACE') && CONFIG.HOJA_STAFF_ID) return { sheetId: CONFIG.HOJA_STAFF_ID, sheetPest: CONFIG.HOJA_STAFF_PEST, sub: 'ENLACE', esJef: false };
  return null;
}

// Destino de escritura de una JEFATURA (su propio archivo). Acepta el código
// (PROCEDIMIENTOS/MANUALES/GESTION_AMBIENTAL/GESTION_OBRAS) o el nombre largo.
function hojaDeJefatura_(jefatura) {
  var j = String(jefatura || '').toUpperCase();
  if (!/^(PROCEDIMIENTOS|MANUALES|GESTION_AMBIENTAL|GESTION_OBRAS)$/.test(j)) j = detectarJefatura_(jefatura);
  if (j === 'PROCEDIMIENTOS'    && CONFIG.HOJA_JDPC_ID)  return { sheetId: CONFIG.HOJA_JDPC_ID,  sheetPest: CONFIG.HOJA_JDPC_PEST,  sub: 'SPAC', esJef: true, jefatura: 'PROCEDIMIENTOS' };
  if (j === 'MANUALES'          && CONFIG.HOJA_JDIMA_ID) return { sheetId: CONFIG.HOJA_JDIMA_ID, sheetPest: CONFIG.HOJA_JDIMA_PEST, sub: 'SPAC', esJef: true, jefatura: 'MANUALES' };
  if (j === 'GESTION_AMBIENTAL' && CONFIG.HOJA_JDGA_ID)  return { sheetId: CONFIG.HOJA_JDGA_ID,  sheetPest: CONFIG.HOJA_JDGA_PEST,  sub: 'SGOI', esJef: true, jefatura: 'GESTION_AMBIENTAL' };
  if (j === 'GESTION_OBRAS'     && CONFIG.HOJA_JDGOI_ID) return { sheetId: CONFIG.HOJA_JDGOI_ID, sheetPest: CONFIG.HOJA_JDGOI_PEST, sub: 'SGOI', esJef: true, jefatura: 'GESTION_OBRAS' };
  return null;
}

// Escribe un valor en la columna "Estatus" de la fila de una tarea, en su hoja
// de origen. Lo usa el Director al Validar una tarea del Enlace (Estatus →
// "Atendida" en el Excel del Enlace).
function fijarEstatusHoja(token, id, valor) {
  if (!sesionValida_(token)) return { ok: false, error: 'Sesión no válida.' };
  var dest = hojaDeId_(id);
  if (!dest) return { ok: false, error: 'No se encontró la hoja de la tarea.' };
  var ss = SpreadsheetApp.openById(dest.sheetId);
  var hoja = ss.getSheetByName(dest.sheetPest) || ss.getSheets()[0];
  if (!hoja) return { ok: false, error: 'No existe la pestaña destino.' };
  var valores = hoja.getDataRange().getValues();
  var e = -1;
  for (var i = 0; i < valores.length; i++) { if (norm_(valores[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return { ok: false, error: 'No se encontró el encabezado (ID).' };
  var iEst = valores[e].map(norm_).indexOf('estatus');
  if (iEst < 0) return { ok: false, error: 'No hay columna Estatus en la hoja.' };
  var fila = localizarFila_(valores, e, id);
  if (fila < 0) return { ok: false, error: 'No se encontró la tarea ' + id + '.' };
  hoja.getRange(fila, iEst + 1).setValue(valor);
  invalidarCacheTareas_();
  return { ok: true };
}

// ¿La sesión puede editar/eliminar tareas de esa hoja? El Director gestiona
// todo lo que ve (subdirección, DPAC, Enlace); el subdirector, lo de su área.
function puedeGestionar_(sesion, dest) {
  if (sesion.rol === 'Director') return true;
  return sesion.rol === 'Capturista' && sesion.subdireccion === dest.sub;
}

// Actualiza (edita) una tarea existente. Mismos permisos que eliminar.
function actualizarTarea(token, id, datos) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  datos = datos || {};
  id = String(id || '').trim();
  var dest = hojaDeId_(id);
  if (!dest) return { ok: false, error: 'Esa subdirección aún no tiene hoja configurada.' };
  if (!puedeGestionar_(sesion, dest)) return { ok: false, error: 'No tienes permiso para editar esta tarea.' };

  // Si el Director cambió la subdirección a una distinta, movemos la tarea
  // entre hojas (la fila origen se borra y se inserta una nueva en destino).
  var subNueva = String(datos.subdireccion || '').toUpperCase();
  if (subNueva && subNueva !== dest.sub) {
    var destNuevo = subToDest_(subNueva);
    if (!destNuevo) return { ok: false, error: 'La subdirección "' + subNueva + '" aún no tiene hoja configurada.' };
    return moverTareaEntreHojas_(id, dest, destNuevo, datos);
  }

  var sheetId = dest.sheetId, sheetPest = dest.sheetPest, esJef = dest.esJef;
  var hoja = obtenerHojaEscritura_(sheetId, sheetPest);
  if (!hoja) return { ok: false, error: 'No existe ninguna pestaña en la hoja destino.' };
  var valores = hoja.getDataRange().getValues();
  var e = -1;
  for (var i = 0; i < valores.length; i++) { if (norm_(valores[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return { ok: false, error: 'No se encontró el encabezado (ID).' };
  var filaSheet = localizarFila_(valores, e, id);
  if (filaSheet < 0) return { ok: false, error: 'No se encontró la tarea.' };

  var enc = valores[e].map(norm_);
  function setCell(nombre, val) {
    var idx = enc.indexOf(nombre);
    if (idx < 0) idx = enc.findIndex(function (c) { return c.indexOf(nombre) >= 0; });
    if (idx >= 0) hoja.getRange(filaSheet, idx + 1).setValue(val);
  }
  var fecha = String(datos.fecha || '');
  var mm = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mm) fecha = mm[3] + '/' + mm[2] + '/' + mm[1];

  if (datos.responsable !== undefined) setCell('responsable', datos.responsable);
  if (datos.tema !== undefined) setCell('tema', datos.tema);
  if (datos.areas !== undefined) setCell('areas', datos.areas);
  if (datos.acuerdos !== undefined) setCell('acuerdos realizados', datos.acuerdos);
  if (datos.accion !== undefined) setCell('accion', datos.accion);
  if (datos.fecha !== undefined) setCell('fecha', fecha);
  if (datos.url) setCell('url', datos.url);
  // Si la tarea ahora es JEFATURA, escribimos el nombre legible en la columna
  // "Jefatura" para que la próxima lectura la reconozca como tal. Si volvió a
  // subdirección, limpiamos la celda.
  if (datos.nivel === 'jefatura' && datos.jefatura) {
    var nombreJef = ({
      'PROCEDIMIENTOS':   'Jefatura de Departamento de Procedimientos de Construcción',
      'MANUALES':         'Jefatura de Departamento de Implementación de Manuales Administrativos',
      'GESTION_AMBIENTAL':'Jefatura de Departamento de Gestión Ambiental',
      'GESTION_OBRAS':    'Jefatura de Departamento de Gestión de Obras Inducidas'
    })[String(datos.jefatura).toUpperCase()] || datos.jefatura;
    setCell('jefatura', nombreJef);
  } else if (datos.nivel === 'subdireccion') {
    setCell('jefatura', '');
  }
  agregarAreas_(datos.areas);
  invalidarCacheTareas_();
  return { ok: true };
}

// Mapea código de subdirección (SPAC/SA/SGOI/DPAC/STAFF) a su hoja destino.
// Devuelve null si no hay hoja configurada para esa subdirección.
function subToDest_(sub) {
  return hojaDeSubdir_(sub);
}

// Mueve una tarea de su hoja origen a una hoja destino: lee la fila, crea una
// nueva fila en destino con un ID nuevo (prefijo de la subdir destino), borra
// la fila origen y renombra el registro en Estados/Bitácora.
function moverTareaEntreHojas_(idViejo, destOrig, destNuevo, datos) {
  var hO = obtenerHojaEscritura_(destOrig.sheetId, destOrig.sheetPest);
  if (!hO) return { ok: false, error: 'Hoja origen no existe.' };
  var valOrig = hO.getDataRange().getValues();
  var eO = -1;
  for (var i = 0; i < valOrig.length; i++) { if (norm_(valOrig[i][0]) === 'id') { eO = i; break; } }
  if (eO < 0) return { ok: false, error: 'Encabezado origen no encontrado.' };
  var filaOrigIdx = localizarFila_(valOrig, eO, idViejo);
  if (filaOrigIdx < 0) return { ok: false, error: 'Tarea no encontrada en origen.' };
  var encOrig = valOrig[eO].map(norm_);
  var filaOrig = valOrig[filaOrigIdx - 1];

  var hN = obtenerHojaEscritura_(destNuevo.sheetId, destNuevo.sheetPest);
  if (!hN) return { ok: false, error: 'Hoja destino no existe.' };
  var valNuevo = hN.getDataRange().getValues();
  var eN = -1;
  for (var j = 0; j < valNuevo.length; j++) { if (norm_(valNuevo[j][0]) === 'id') { eN = j; break; } }
  if (eN < 0) return { ok: false, error: 'Encabezado destino no encontrado.' };
  var encNuevo = valNuevo[eN].map(norm_);

  var prefijo = destNuevo.sub + '-';
  var idNuevo = siguienteIdSheet_(valNuevo, eN, prefijo);

  function getO(nombre) {
    var idx = encOrig.indexOf(nombre);
    if (idx < 0) idx = encOrig.findIndex(function (h) { return h.indexOf(nombre) >= 0; });
    return idx >= 0 ? filaOrig[idx] : '';
  }
  var filaNueva = [];
  for (var c = 0; c < encNuevo.length; c++) filaNueva.push('');
  function setN(nombre, val) {
    var idx = encNuevo.indexOf(nombre);
    if (idx < 0) idx = encNuevo.findIndex(function (h) { return h.indexOf(nombre) >= 0; });
    if (idx >= 0) filaNueva[idx] = val;
  }
  setN('id', idNuevo);
  setN('responsable', datos.responsable !== undefined ? datos.responsable : getO('responsable'));
  setN('tema',        datos.tema !== undefined        ? datos.tema        : getO('tema'));
  setN('areas',       datos.areas !== undefined       ? datos.areas       : getO('areas'));
  setN('acuerdos realizados', datos.acuerdos !== undefined ? datos.acuerdos : getO('acuerdos realizados'));
  setN('accion',      datos.accion !== undefined      ? datos.accion      : getO('accion'));
  var fecha = datos.fecha !== undefined ? String(datos.fecha) : String(getO('fecha') || '');
  var mm = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mm) fecha = mm[3] + '/' + mm[2] + '/' + mm[1];
  setN('fecha', fecha);
  setN('estatus', String(getO('estatus') || 'En Proceso'));
  setN('url', datos.url || getO('url'));

  hN.appendRow(filaNueva);
  hO.deleteRow(filaOrigIdx);
  // Renombra el ID en Estados y Bitácora.
  renombrarIdEstados_(idViejo, idNuevo);
  invalidarCacheTareas_();
  return { ok: true, nuevoId: idNuevo, movido: true };
}

// Renombra (en su lugar) el ID viejo por el nuevo dentro de las hojas Estados
// y Bitacora — así no se pierden las palomas/observaciones ni el historial.
function renombrarIdEstados_(idViejo, idNuevo) {
  try {
    var hE = hojaEstados_(false);
    if (hE) {
      var dE = hE.getDataRange().getValues();
      for (var r = 1; r < dE.length; r++) {
        if (String(dE[r][0]).trim() === idViejo) {
          hE.getRange(r + 1, 1).setValue(idNuevo);
          break;
        }
      }
    }
  } catch (e1) { /* best effort */ }
  try {
    var ss = SpreadsheetApp.openById(CONFIG.HOJA_USUARIOS_ID);
    var hB = ss.getSheetByName('Bitacora');
    if (hB) {
      var dB = hB.getDataRange().getValues();
      if (dB.length > 0) {
        var heads = dB[0].map(norm_);
        var iId = heads.indexOf('idtarea');
        if (iId < 0) iId = heads.findIndex(function (h) { return h.indexOf('id') >= 0 && h.indexOf('tarea') >= 0; });
        if (iId >= 0) {
          for (var rb = 1; rb < dB.length; rb++) {
            if (String(dB[rb][iId]).trim() === idViejo) {
              hB.getRange(rb + 1, iId + 1).setValue(idNuevo);
            }
          }
        }
      }
    }
  } catch (e2) { /* best effort */ }
}

// Elimina una tarea (borra su fila del Sheet). Solo el Subdirector de SPAC
// (sus tareas de subdirección y de jefatura). La fila se ubica por ID fijo.
function eliminarTarea(token, id) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  id = String(id || '').trim();

  var dest = hojaDeId_(id);
  if (!dest) return { ok: false, error: 'Esa subdirección aún no tiene hoja configurada.' };
  // SPAC (subdirección y jefatura) solo las borra el Subdirector de SPAC; las de
  // DPAC solo el Director.
  if (!puedeGestionar_(sesion, dest)) return { ok: false, error: 'No tienes permiso para eliminar esta tarea.' };

  var sheetId = dest.sheetId, sheetPest = dest.sheetPest;
  var hoja = obtenerHojaEscritura_(sheetId, sheetPest);
  if (!hoja) return { ok: false, error: 'No existe ninguna pestaña en la hoja destino.' };

  var valores = hoja.getDataRange().getValues();
  var e = -1;
  for (var i = 0; i < valores.length; i++) { if (norm_(valores[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return { ok: false, error: 'No se encontró el encabezado (ID).' };

  var filaSheet = localizarFila_(valores, e, id);
  if (filaSheet < 0) return { ok: false, error: 'No se encontró la fila de la tarea.' };

  hoja.deleteRow(filaSheet);
  invalidarCacheTareas_();
  return { ok: true };
}

// ====================== ÁREAS (catálogo) =================================
// Lista base de áreas + las extra que se vayan agregando (hoja "Areas").
var AREAS_BASE = [
  'Dirección de Procesos Administrativos de Construcción',
  'Subdirección de Procesos Administrativos de Construcción',
  'Subdirección de Archivo',
  'Subdirección de Gestión de Obras Inducidas',
  'Jefatura de Departamento de Procedimientos de Construcción',
  'Jefatura de Departamento de Implementación de Manuales Administrativos',
  'Jefatura de Departamento de Gestión Ambiental',
  'Jefatura de Departamento de Gestión de Obras Inducidas',
  'Staff'
];

function obtenerAreas(token) {
  if (!sesionValida_(token)) return { ok: false, areas: AREAS_BASE.slice() };
  var todas = AREAS_BASE.slice();
  leerAreasExtra_().forEach(function (a) { if (todas.indexOf(a) < 0) todas.push(a); });
  return { ok: true, areas: todas };
}

function leerAreasExtra_() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.HOJA_USUARIOS_ID);
    var hoja = ss.getSheetByName('Areas');
    if (!hoja) return [];
    var vals = hoja.getDataRange().getValues();
    var out = [];
    for (var r = 0; r < vals.length; r++) {
      var a = String(vals[r][0] || '').trim();
      if (a && norm_(a) !== 'area' && norm_(a) !== 'areas') out.push(a);
    }
    return out;
  } catch (e) { return []; }
}

// Agrega a la hoja "Areas" las áreas que no existan aún (base ni extras).
function agregarAreas_(areasStr) {
  if (!areasStr) return;
  var nuevas = String(areasStr).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!nuevas.length) return;
  var conocidas = AREAS_BASE.concat(leerAreasExtra_()).map(norm_);
  var porAgregar = [];
  nuevas.forEach(function (a) {
    var n = norm_(a);
    if (conocidas.indexOf(n) < 0 && porAgregar.map(norm_).indexOf(n) < 0) porAgregar.push(a);
  });
  if (!porAgregar.length) return;
  var ss = SpreadsheetApp.openById(CONFIG.HOJA_USUARIOS_ID);
  var hoja = ss.getSheetByName('Areas');
  if (!hoja) { hoja = ss.insertSheet('Areas'); hoja.appendRow(['Area']); }
  porAgregar.forEach(function (a) { hoja.appendRow([a]); });
}

// Carpeta de Drive según la subdirección de quien sube. Si esa subdirección
// no tiene carpeta configurada, usa la general (DPAC).
function carpetaDe_(sesion) {
  sesion = sesion || {};
  // Si quien sube es de una jefatura, usa la carpeta de esa jefatura.
  var jef = detectarJefatura_(sesion.jefatura);
  var mj = {
    PROCEDIMIENTOS:    CONFIG.DRIVE_CARPETA_JDPC,
    MANUALES:          CONFIG.DRIVE_CARPETA_JDIMA,
    GESTION_AMBIENTAL: CONFIG.DRIVE_CARPETA_JDGA,
    GESTION_OBRAS:     CONFIG.DRIVE_CARPETA_JDGOI
  };
  if (jef && mj[jef] && String(mj[jef]).trim()) return mj[jef];
  // Si no, la carpeta de su subdirección. STAFF/ENLACE comparten carpeta.
  var ms = {
    DPAC:   CONFIG.DRIVE_CARPETA_DPAC,
    SPAC:   CONFIG.DRIVE_CARPETA_SPAC,
    SGOI:   CONFIG.DRIVE_CARPETA_SGOI,
    SA:     CONFIG.DRIVE_CARPETA_SA,
    STAFF:  CONFIG.DRIVE_CARPETA_STAFF,
    ENLACE: CONFIG.DRIVE_CARPETA_STAFF
  };
  var id = ms[String(sesion.subdireccion || '').toUpperCase()];
  return (id && String(id).trim()) ? id : CONFIG.DRIVE_CARPETA_ID;
}

// Carpeta de Drive según el ÁREA DESTINO de la tarea (el código elegido en el
// formulario: SPAC/JDPC/JDIMA/SGOI/JDGA/JDGOI/SA/DPAC/ENLACE). Devuelve '' si esa
// área no tiene carpeta configurada (para que el llamador caiga al respaldo).
function carpetaDeArea_(cod) {
  var m = {
    DPAC:  CONFIG.DRIVE_CARPETA_DPAC,
    SPAC:  CONFIG.DRIVE_CARPETA_SPAC,
    JDPC:  CONFIG.DRIVE_CARPETA_JDPC,
    JDIMA: CONFIG.DRIVE_CARPETA_JDIMA,
    SGOI:  CONFIG.DRIVE_CARPETA_SGOI,
    JDGA:  CONFIG.DRIVE_CARPETA_JDGA,
    JDGOI: CONFIG.DRIVE_CARPETA_JDGOI,
    SA:    CONFIG.DRIVE_CARPETA_SA,
    STAFF: CONFIG.DRIVE_CARPETA_STAFF,
    ENLACE:CONFIG.DRIVE_CARPETA_STAFF,
    VOLANTES: CONFIG.DRIVE_CARPETA_VOLANTES
  };
  var id = m[String(cod || '').toUpperCase()];
  return (id && String(id).trim()) ? id : '';
}

// Sube un archivo (en base64) a la carpeta de la subdirección del usuario y
// devuelve su enlace. Lo usa el arrastrar-y-soltar del formulario de nueva tarea.
function subirArchivo(token, nombre, mime, base64, destino) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  // 1º por el ÁREA DESTINO de la tarea (lo que se eligió en el formulario);
  // si esa área no tiene carpeta, cae a la del usuario que sube; y si tampoco,
  // a la general. Así el adjunto vive en la carpeta del área dueña de la tarea.
  var carpetaId = (destino ? carpetaDeArea_(destino) : '') || carpetaDe_(sesion);
  if (!carpetaId) return { ok: false, error: 'Falta configurar la carpeta de Drive.' };
  try {
    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, mime || 'application/octet-stream', nombre || 'adjunto');
    var carpeta = DriveApp.getFolderById(carpetaId);
    var archivo = carpeta.createFile(blob);
    try { archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    return { ok: true, url: archivo.getUrl(), nombre: archivo.getName() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Manda a la PAPELERA de Drive el archivo de una URL (cuando se quita un adjunto
// de una acción). Va a la papelera (recuperable ~30 días), NO se borra para
// siempre. Best-effort: si el archivo ya no existe o no es accesible, no truena.
function borrarArchivoDrive(token, url) {
  if (!sesionValida_(token)) return { ok: false, error: 'Sesión no válida.' };
  var id = idDeUrlDrive_(url);
  if (!id) return { ok: false, error: 'No se reconoció el archivo.' };
  try {
    DriveApp.getFileById(id).setTrashed(true);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Extrae el ID de archivo de una URL de Drive: .../d/ID/..., ...?id=ID, o el
// token largo que aparezca en la URL.
function idDeUrlDrive_(url) {
  var s = String(url || '');
  var m = s.match(/\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/) || s.match(/([-\w]{25,})/);
  return m ? m[1] : '';
}

// ====================== ESTADOS (guardar avances) =========================
// La hoja Estados vive en el mismo archivo que Usuarios.
function estadosSpreadsheetId_() { return CONFIG.HOJA_USUARIOS_ID; }
function estadosPestana_() { return CONFIG.HOJA_ESTADOS_PEST || 'Estados'; }
var ESTADOS_HEADERS = ['ID', 'Estatus', 'Validada', 'EnValidadas', 'FinalizadoPor', 'FechaFinalizacion', 'ValidadoPor', 'FechaValidacion', 'ActualizadoPor', 'ActualizadoEn', 'Comentario', 'Confirmada', 'EnviadoPor', 'FechaEnvio', 'Eliminada', 'CreadoPor', 'FechaCreacion', 'EliminadoPor', 'FechaEliminacion', 'Checklist', 'ObservacionesResp', 'ObservacionesDir'];

function hojaEstados_(crear) {
  var ss = SpreadsheetApp.openById(estadosSpreadsheetId_());
  var hoja = ss.getSheetByName(estadosPestana_());
  if (!hoja && crear) {
    hoja = ss.insertSheet(estadosPestana_());
    hoja.appendRow(ESTADOS_HEADERS);
  }
  return hoja;
}

// Guarda (o actualiza) el avance de una tarea. `e` trae el estado actual.
function guardarEstado(token, id, e) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  e = e || {};
  var hoja = hojaEstados_(true);
  var datos = hoja.getDataRange().getValues();
  if (datos.length === 0 || norm_(datos[0][0]) !== 'id') {
    hoja.clear(); hoja.appendRow(ESTADOS_HEADERS); datos = [ESTADOS_HEADERS];
  } else if (datos[0].map(norm_).indexOf('observacionesdir') === -1) {
    // Hoja creada antes de agregar columnas nuevas (Checklist/Observaciones):
    // repara el encabezado. No borra datos; las columnas nuevas quedan al final.
    hoja.getRange(1, 1, 1, ESTADOS_HEADERS.length).setValues([ESTADOS_HEADERS]);
    datos[0] = ESTADOS_HEADERS;
  }
  var fila = [
    id,
    e.estatus || '',
    e.validada ? 'Si' : '',
    e.en_validadas ? 'Si' : '',
    e.finalizado_por || '',
    e.fecha_finalizacion || '',
    e.validado_por || '',
    e.fecha_validacion || '',
    sesion.nombre || sesion.email || '',
    ahoraStamp_(),
    e.comentario_devolucion || '',
    (e.confirmada === false ? 'No' : 'Si'),
    e.enviado_por || '',
    e.fecha_envio || '',
    e.eliminada ? 'Si' : '',
    e.creado_por || '',
    e.fecha_creacion || '',
    e.eliminado_por || '',
    e.fecha_eliminacion || '',
    e.checklist_json || '',           // checklist serializado (JSON string)
    e.observaciones_resp || '',
    e.observaciones_dir || ''
  ];
  var writeRow = -1;
  for (var r = 1; r < datos.length; r++) {
    if (String(datos[r][0]).trim() === String(id).trim()) { writeRow = r + 1; break; }
  }
  if (writeRow < 0) writeRow = hoja.getLastRow() + 1;
  // Escribe la fila como TEXTO (formato '@') para que Google Sheets NO convierta
  // los timestamps a fecha (eso causaba el desfase de zona horaria al releerlos).
  var rng = hoja.getRange(writeRow, 1, 1, fila.length);
  rng.setNumberFormat('@');
  rng.setValues([fila]);
  invalidarCacheTareas_();
  return { ok: true };
}

// Lee la hoja Estados como mapa { id: {estado} }.
function leerEstados_() {
  try {
    var hoja = hojaEstados_(false);
    if (!hoja) return {};
    var datos = hoja.getDataRange().getValues();
    if (datos.length < 2) return {};
    var enc = datos[0].map(norm_);
    var iId = enc.indexOf('id'), iEst = enc.indexOf('estatus'), iVal = enc.indexOf('validada'),
        iEnV = enc.indexOf('envalidadas'), iFp = enc.indexOf('finalizadopor'), iFf = enc.indexOf('fechafinalizacion'),
        iVp = enc.indexOf('validadopor'), iFv = enc.indexOf('fechavalidacion'), iCom = enc.indexOf('comentario'),
        iConf = enc.indexOf('confirmada'), iEp = enc.indexOf('enviadopor'), iFe = enc.indexOf('fechaenvio'),
        iElim = enc.indexOf('eliminada'), iCp = enc.indexOf('creadopor'), iFc = enc.indexOf('fechacreacion'),
        iElp = enc.indexOf('eliminadopor'), iFel = enc.indexOf('fechaeliminacion'),
        iChk = enc.indexOf('checklist'), iOR = enc.indexOf('observacionesresp'), iOD = enc.indexOf('observacionesdir');
    var map = {};
    for (var r = 1; r < datos.length; r++) {
      var f = datos[r], id = String(f[iId] || '').trim();
      if (!id) continue;
      map[id] = {
        estatus: String(f[iEst] || '').trim(),
        validada: norm_(f[iVal]) === 'si',
        en_validadas: norm_(f[iEnV]) === 'si',
        finalizado_por: String(f[iFp] || '').trim(),
        fecha_finalizacion: fechaHora_(f[iFf]),
        validado_por: String(f[iVp] || '').trim(),
        fecha_validacion: fechaHora_(f[iFv]),
        comentario_devolucion: iCom >= 0 ? String(f[iCom] || '').trim() : '',
        confirmada: iConf >= 0 ? norm_(f[iConf]) !== 'no' : true,   // default sí (directo); 'No' = devuelta
        enviado_por: iEp >= 0 ? String(f[iEp] || '').trim() : '',
        fecha_envio: iFe >= 0 ? fechaHora_(f[iFe]) : '',
        eliminada: iElim >= 0 ? norm_(f[iElim]) === 'si' : false,
        creado_por: iCp >= 0 ? String(f[iCp] || '').trim() : '',
        fecha_creacion: iFc >= 0 ? fechaHora_(f[iFc]) : '',
        eliminado_por: iElp >= 0 ? String(f[iElp] || '').trim() : '',
        fecha_eliminacion: iFel >= 0 ? fechaHora_(f[iFel]) : '',
        // Checklist viene como JSON-string; el front lo parsea. Vacío = sin cambios.
        checklist_json: iChk >= 0 ? String(f[iChk] || '').trim() : '',
        observaciones_resp: iOR >= 0 ? String(f[iOR] || '').trim() : '',
        observaciones_dir:  iOD >= 0 ? String(f[iOD] || '').trim() : ''
      };
    }
    return map;
  } catch (err) { return {}; }
}

// Aplica los avances guardados sobre las tareas recién leídas de las hojas.
function aplicarEstados_(tareas) {
  var estados = leerEstados_();
  tareas.forEach(function (t) {
    var e = estados[t.id];
    if (!e) return;
    if (e.estatus) t.estatus = e.estatus;
    t.validada = e.validada;
    t.en_validadas = e.en_validadas;
    if (e.finalizado_por) t.finalizado_por = e.finalizado_por;
    if (e.fecha_finalizacion) t.fecha_finalizacion = e.fecha_finalizacion;
    if (e.validado_por) t.validado_por = e.validado_por;
    if (e.fecha_validacion) t.fecha_validacion = e.fecha_validacion;
    t.comentario_devolucion = e.comentario_devolucion || '';
    t.confirmada = !!e.confirmada;
    t.enviado_por = e.enviado_por || '';
    t.fecha_envio = e.fecha_envio || '';
    t.eliminada = !!e.eliminada;
    t.creado_por = e.creado_por || '';
    t.fecha_creacion = e.fecha_creacion || '';
    t.eliminado_por = e.eliminado_por || '';
    t.fecha_eliminacion = e.fecha_eliminacion || '';
    t.avance = (t.estatus === 'Atendida' || t.estatus === 'Archivada') ? 100 : t.avance;
    // Checklist + observaciones (modelo nuevo de validación adentro de la tarea).
    if (e.checklist_json) {
      try {
        var ck = JSON.parse(e.checklist_json);
        if (Array.isArray(ck)) t.checklist = ck;
      } catch (errCk) { /* JSON mal formado: ignora y deja el del Excel */ }
    }
    if (typeof e.observaciones_resp === 'string') t.observaciones_resp = e.observaciones_resp;
    if (typeof e.observaciones_dir  === 'string') t.observaciones_dir  = e.observaciones_dir;
  });
  // Las tareas de JEFATURA nunca escalan: SIEMPRE quedan en 'En Proceso'
  // (datos del flujo anterior pudieron quedar como Atendida/Archivada). Si
  // estaban validadas/archivadas, se conserva quién y cuándo como "Finalizada".
  tareas.forEach(function (t) {
    if (t.nivel !== 'jefatura') return;
    if (t.estatus === 'Atendida' || t.estatus === 'Archivada') {
      if (!t.finalizado_por) t.finalizado_por = t.validado_por || '';
      if (!t.fecha_finalizacion) t.fecha_finalizacion = t.fecha_validacion || '';
    }
    t.estatus = 'En Proceso';
    t.validada = false;
    t.en_validadas = false;
    t.confirmada = false;
  });
  // Tareas de SUBDIRECCIÓN que aún NO están en Validadas: en el flujo nuevo no
  // existe "finalizada/validada" hasta que el Director valida (Archivada). Se
  // limpian los datos del flujo anterior (p.ej. SPAC-001 finalizada/validada
  // por migración) para que no aparezcan estando todavía sin enviar.
  tareas.forEach(function (t) {
    if (t.nivel === 'jefatura' || t.estatus === 'Archivada') return;
    t.finalizado_por = ''; t.fecha_finalizacion = '';
    t.validado_por = '';   t.fecha_validacion = '';
    t.validada = false;
  });
}

function ahoraStamp_() { return fechaHora_(new Date()); }

// Formatea a "DD/MM/AAAA HH:MM" (sin "GMT-06:00 hora estándar"). Acepta un
// objeto Date (como los que devuelve getValues sobre celdas de fecha) o texto.
var TZ_APP = 'America/Mexico_City';   // zona horaria de la aplicación (UTC-6)

function fechaHora_(v) {
  var d = (v instanceof Date) ? v : null;
  if (!d && v) {
    var s = String(v).trim();
    // Texto que ya viene "dd/mm/aaaa ..." se deja tal cual (solo quita el GMT).
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.replace(/\s*GMT.*$/i, '').replace(/\s*\(.*\)$/, '').trim();
    var p = new Date(s);
    if (!isNaN(p.getTime())) d = p; else return s.replace(/\s*GMT.*$/i, '').replace(/\s*\(.*\)$/, '').trim();
  }
  if (!d || isNaN(d.getTime())) return '';
  // Formatea SIEMPRE en la zona de la app, sin importar la zona del proyecto.
  return Utilities.formatDate(d, TZ_APP, 'dd/MM/yyyy HH:mm');
}

// ====================== BITÁCORA (persistente) ===========================
// Vive en el mismo archivo que Usuarios, pestaña "Bitacora".
var BITACORA_HEADERS = ['Fecha', 'Usuario', 'Accion', 'IdTarea', 'EstatusAnterior', 'EstatusNuevo', 'Comentario'];

function hojaBitacora_(crear) {
  var ss = SpreadsheetApp.openById(CONFIG.HOJA_USUARIOS_ID);
  var hoja = ss.getSheetByName('Bitacora');
  if (!hoja && crear) { hoja = ss.insertSheet('Bitacora'); hoja.appendRow(BITACORA_HEADERS); }
  return hoja;
}

// Agrega un movimiento a la bitácora.
function registrarBitacora(token, ent) {
  if (!sesionValida_(token)) return { ok: false };
  ent = ent || {};
  var hoja = hojaBitacora_(true);
  var fila = [
    ent.fecha || ahoraStamp_(), ent.usuario || '', ent.accion || '', ent.id_tarea || '',
    ent.estatus_anterior || '', ent.estatus_nuevo || '', ent.comentario || ''
  ];
  // Escribe como TEXTO para que la fecha no se convierta (desfase de zona).
  var row = hoja.getLastRow() + 1;
  var rng = hoja.getRange(row, 1, 1, fila.length);
  rng.setNumberFormat('@');
  rng.setValues([fila]);
  return { ok: true };
}

// Devuelve la bitácora (más reciente primero) para la vista y el historial.
function obtenerBitacora(token) {
  if (!sesionValida_(token)) return { ok: false, bitacora: [] };
  var hoja = hojaBitacora_(false);
  if (!hoja) return { ok: true, bitacora: [] };
  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { ok: true, bitacora: [] };
  var enc = datos[0].map(norm_);
  var iF = enc.indexOf('fecha'), iU = enc.indexOf('usuario'), iA = enc.indexOf('accion'),
      iId = enc.indexOf('idtarea'), iEa = enc.indexOf('estatusanterior'), iEn = enc.indexOf('estatusnuevo'),
      iC = enc.indexOf('comentario');
  var out = [];
  for (var r = 1; r < datos.length; r++) {
    var f = datos[r];
    if (!String(f[iF] || '').trim() && !String(f[iId] || '').trim()) continue;
    out.push({
      fecha: fechaHora_(f[iF]), usuario: String(f[iU] || ''), accion: String(f[iA] || ''),
      id_tarea: String(f[iId] || ''), estatus_anterior: String(f[iEa] || ''),
      estatus_nuevo: String(f[iEn] || ''), comentario: String(iC >= 0 ? f[iC] || '' : '')
    });
  }
  return { ok: true, bitacora: out.reverse() };   // más reciente primero
}

// ⚠️ REINICIO PARA PRUEBAS: vacía por completo las hojas Estados y Bitacora
// (deja solo los encabezados). Con esto las tareas vuelven a su estado REAL
// según los Excel (jefatura → En Proceso; subdirección → Para validar), sin
// validaciones, envíos, papelera ni historial acumulado de pruebas.
// NO toca las hojas de tareas (Jefaturas/SPAC/DPAC) ni la de Usuarios.
// Córrela UNA vez desde el editor (Ejecutar ▶) y recarga la app.
function reiniciarPruebas() {
  var est = hojaEstados_(true);
  if (est) { est.clearContents(); est.getRange(1, 1, 1, ESTADOS_HEADERS.length).setValues([ESTADOS_HEADERS]); }
  var bit = hojaBitacora_(true);
  if (bit) { bit.clearContents(); bit.getRange(1, 1, 1, BITACORA_HEADERS.length).setValues([BITACORA_HEADERS]); }
  Logger.log('✅ Reinicio de pruebas: Estados y Bitacora vaciados (solo encabezados). Las tareas quedan como en los Excel.');
  return { ok: true };
}

// ============================== HELPERS ===================================
function leerHoja_(id, pestana) {
  var ss = SpreadsheetApp.openById(id);
  // Si se pidió una pestaña por nombre y no existe, usa la PRIMERA como respaldo
  // (así no truena si el nombre no coincide exacto, p.ej. la hoja DPAC).
  var hoja = pestana ? ss.getSheetByName(pestana) : null;
  if (!hoja) hoja = ss.getSheets()[0];
  if (!hoja) throw new Error('La hoja ' + id + ' no tiene pestañas.');
  return hoja.getDataRange().getValues();
}

// Versión de getSheetByName que cae a la primera pestaña si no encuentra la
// nombrada. Para usar en operaciones de ESCRITURA (crearTarea, actualizarTarea,
// moverTareaEntreHojas_) y que no truenen porque la pestaña se llame distinto.
function obtenerHojaEscritura_(sheetId, pestana) {
  var ss = SpreadsheetApp.openById(sheetId);
  var hoja = pestana ? ss.getSheetByName(pestana) : null;
  if (!hoja) hoja = ss.getSheets()[0];
  return hoja || null;
}

function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function normEstatus_(s) {
  var v = norm_(s);
  if (v === 'archivada' || v === 'archivado') return 'Archivada';
  if (v === 'atendida' || v === 'atendido' || v === 'concluida' || v === 'concluido') return 'Atendida';
  return 'En Proceso';
}

function detectarJefatura_(texto) {
  var v = norm_(texto);
  if (!v) return '';
  if (/manual/.test(v))                            return 'MANUALES';
  if (/procedimiento|procesos de construc/.test(v)) return 'PROCEDIMIENTOS';
  if (/ambient/.test(v))                           return 'GESTION_AMBIENTAL';
  if (/obras inducid|inducidas/.test(v))           return 'GESTION_OBRAS';
  // Códigos cortos también funcionan.
  if (v === 'jdpc')  return 'PROCEDIMIENTOS';
  if (v === 'jdima') return 'MANUALES';
  if (v === 'jdga')  return 'GESTION_AMBIENTAL';
  if (v === 'jdgoi') return 'GESTION_OBRAS';
  return '';
}

// Prefijo de ID según la jefatura.
function prefijoJef_(jefatura) {
  if (jefatura === 'MANUALES')          return 'JDIMA-';
  if (jefatura === 'GESTION_AMBIENTAL') return 'JDGA-';
  if (jefatura === 'GESTION_OBRAS')     return 'JDGOI-';
  return 'JDPC-';
}

// Regex que reconoce un ID estable (incluye prefijos viejos por compatibilidad).
var RE_ID_ESTABLE = /^(?:JDPC|JDIMA|JDGA|JDGOI|JSPAC|SPACJ|SPAC|DPAC|STAFF|ENLACE|SA|SGOI)-\d+/i;

// Estatus inicial de una tarea: en el modelo NUEVO todas las activas nacen
// "En Proceso" (la validación es por checklist, ya no hay un estado intermedio
// "Atendida / Para validar"). Estados sobreescribe si hay avance guardado.
function estatusInicial_(nivel, sub) {
  return 'En Proceso';
}
function _legacyEstatusInicial_(nivel, sub) {
  if (nivel === 'jefatura') return 'En Proceso';
  if (sub === 'DPAC') return 'En Proceso';           // tareas propias del Director
  return 'Atendida';   // subdirecciones y Enlace → "Para validar" (directo a Adrián)
}

function fechaNorm_(celda) {
  if (celda instanceof Date) {
    var d = celda;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var m = String(celda || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? (m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0')) : '';
}

// Parsea el rango de valores de una hoja al mismo formato de tarea que usa la
// app. `nivel` es 'jefatura' o 'subdireccion'; `subCode` es la subdirección
// dueña de la hoja (SPAC por defecto; DPAC para la hoja de la Dirección).
function parsearHoja_(filas, nivel, subCode, jefForzada) {
  subCode = subCode || 'SPAC';
  var e = -1;
  for (var i = 0; i < filas.length; i++) { if (norm_(filas[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return [];

  var enc = filas[e].map(norm_);
  var col = function (n) { return enc.indexOf(n); };
  var find = function (sub) { return enc.findIndex(function (c) { return c.indexOf(sub) >= 0; }); };

  var iResp = col('responsable'), iJef = col('jefatura'), iTema = col('tema'),
      iAreas = find('areas'), iAcu = col('acuerdos realizados'), iAcc = find('accion'),
      iFecha = find('fecha'), iEst = col('estatus'), iUrl = col('url');
  if (iJef < 0) iJef = find('jefatura');   // por si el encabezado no es exacto

  var out = [];
  for (var r = e + 1; r < filas.length; r++) {
    var f = filas[r];
    var tema = String(f[iTema] || '').trim();
    if (!tema) continue;
    // Detección por fila: si la columna "Jefatura" tiene un código reconocible
    // tratamos la fila como JEFATURA aunque la hoja sea de subdirección. Eso
    // permite que Fabiola/Mario asignen tareas a sus jefaturas desde su misma
    // hoja sin necesitar una pestaña aparte.
    var textoJef = String(iJef >= 0 ? f[iJef] : '').trim();
    var jefDetect = textoJef ? detectarJefatura_(textoJef) : '';
    var nivelFila = nivel;
    var jefatura = '';
    if (jefForzada) {
      // La pestaña ya define la jefatura (ej. JDGA/JDGOI). Cualquier fila va
      // como tarea de esa jefatura, sin importar el contenido de la celda.
      jefatura = jefForzada;
      nivelFila = 'jefatura';
    } else if (jefDetect) {
      nivelFila = 'jefatura';
      jefatura = jefDetect;
    } else if (nivel === 'jefatura') {
      jefatura = detectarJefatura_(textoJef || String(f[iAreas] || ''));
    }
    var prefijo = nivelFila === 'jefatura' ? prefijoJef_(jefatura) : (subCode + '-');
    // ID FIJO: usa el de la columna ID si ya es estable; si no, usa el posicional.
    var idCell = String(f[0] || '').trim();
    var id = RE_ID_ESTABLE.test(idCell) ? idCell : (prefijo + String(r - e).padStart(3, '0'));
    // Estatus inicial por origen (lo guardado en Estados lo sobreescribe). Si la
    // hoja marca 'Archivada' explícitamente, se respeta.
    var estHoja = normEstatus_(f[iEst]);
    // En Staff/Enlace, "Atendida" en el Excel significa VALIDADA (→ Validadas).
    var est = (estHoja === 'Archivada' || ((subCode === 'ENLACE' || subCode === 'STAFF') && estHoja === 'Atendida'))
      ? 'Archivada' : estatusInicial_(nivel, subCode);
    var raw = f[iFecha];
    var perm = /^permanente$/i.test(String(raw).trim());
    var fecha = perm ? '' : fechaNorm_(raw);
    out.push({
      id: id, subdireccion: subCode, nivel: nivel, jefatura: jefatura,
      responsable: String(f[iResp] || '').trim(), titulo: tema, tema: tema,
      areas_involucradas: String(f[iAreas] || '').trim(),
      acuerdos_realizados: String(f[iAcu] || '').trim(),
      accion_a_tomar: String(f[iAcc] || '').trim(),
      descripcion: String(f[iAcu] || '').trim(), observaciones: String(f[iAcc] || '').trim(),
      fecha_atencion: fecha, fecha_limite: fecha, permanente: perm,
      estatus: est, avance: est === 'Archivada' ? 100 : 0, confirmada: true,   // directo a "Para validar"; al devolver pasa a false
      url: String(f[iUrl] || '').trim(),
      validado_por: '', fecha_validacion: '', comentarios_director: '', fuente: 'sheet'
    });
  }
  return out;
}
