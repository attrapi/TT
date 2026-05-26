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
const CONFIG = {
  // ID del archivo de cada hoja. Lo sacas de la URL normal del Sheet:
  //   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
  HOJA_JEFATURAS_ID:    'PEGA_AQUI_EL_ID_DE_LA_HOJA_DE_JEFATURAS',
  HOJA_JEFATURAS_PEST:  'Hoja 1',   // nombre exacto de la pestaña

  HOJA_SUBDIR_ID:       'PEGA_AQUI_EL_ID_DE_LA_HOJA_DE_SUBDIRECCION',
  HOJA_SUBDIR_PEST:     'Hoja 1',

  HOJA_USUARIOS_ID:     'PEGA_AQUI_EL_ID_DE_LA_HOJA_USUARIOS',
  HOJA_USUARIOS_PEST:   'Usuarios',

  // URL pública de tu index.html (GitHub Pages):
  APP_HTML_URL:         'https://attrapi.github.io/TT/index.html',

  HORAS_SESION: 8
};
// ==========================================================================

function doGet() {
  var html = UrlFetchApp.fetch(CONFIG.APP_HTML_URL, { muteHttpExceptions: true }).getContentText();
  return HtmlService.createHtmlOutput(html)
    .setTitle('TT · Sistema de Gestión y Validación de Tareas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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

// ============================== DATOS =====================================
// Devuelve TODAS las tareas de SPAC (jefaturas + subdirección) ya parseadas,
// solo si el token de sesión es válido.
function obtenerTareas(token) {
  if (!sesionValida_(token)) return { ok: false, error: 'Sesión no válida. Vuelve a iniciar sesión.' };
  var jef = parsearHoja_(leerHoja_(CONFIG.HOJA_JEFATURAS_ID, CONFIG.HOJA_JEFATURAS_PEST), 'jefatura');
  var sub = parsearHoja_(leerHoja_(CONFIG.HOJA_SUBDIR_ID,    CONFIG.HOJA_SUBDIR_PEST),    'subdireccion');
  return { ok: true, tareas: jef.concat(sub) };
}

// ============================== HELPERS ===================================
function leerHoja_(id, pestana) {
  var ss = SpreadsheetApp.openById(id);
  var hoja = pestana ? ss.getSheetByName(pestana) : ss.getSheets()[0];
  if (!hoja) throw new Error('No existe la pestaña "' + pestana + '" en la hoja ' + id);
  return hoja.getDataRange().getValues();
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
  if (/manual/.test(v)) return 'MANUALES';
  if (/procedimiento|procesos de construc/.test(v)) return 'PROCEDIMIENTOS';
  return 'PROCEDIMIENTOS';
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
// app. `nivel` es 'jefatura' o 'subdireccion'.
function parsearHoja_(filas, nivel) {
  var e = -1;
  for (var i = 0; i < filas.length; i++) { if (norm_(filas[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return [];

  var enc = filas[e].map(norm_);
  var col = function (n) { return enc.indexOf(n); };
  var find = function (sub) { return enc.findIndex(function (c) { return c.indexOf(sub) >= 0; }); };

  var iResp = col('responsable'), iJef = col('jefatura'), iTema = col('tema'),
      iAreas = find('areas'), iAcu = col('acuerdos realizados'), iAcc = find('accion'),
      iFecha = find('fecha'), iEst = col('estatus'), iUrl = col('url');

  var out = [], prefijo = nivel === 'jefatura' ? 'SPACJ-' : 'SPAC-';
  for (var r = e + 1; r < filas.length; r++) {
    var f = filas[r];
    var tema = String(f[iTema] || '').trim();
    if (!tema) continue;
    var id = prefijo + String(r - e).padStart(3, '0');
    var est = normEstatus_(f[iEst]);
    var raw = f[iFecha];
    var perm = /^permanente$/i.test(String(raw).trim());
    var fecha = perm ? '' : fechaNorm_(raw);
    var jefatura = nivel === 'jefatura'
      ? detectarJefatura_(String(iJef >= 0 ? f[iJef] : '') + ' ' + String(f[iAreas] || ''))
      : '';
    out.push({
      id: id, subdireccion: 'SPAC', nivel: nivel, jefatura: jefatura,
      responsable: String(f[iResp] || '').trim(), titulo: tema, tema: tema,
      areas_involucradas: String(f[iAreas] || '').trim(),
      acuerdos_realizados: String(f[iAcu] || '').trim(),
      accion_a_tomar: String(f[iAcc] || '').trim(),
      descripcion: String(f[iAcu] || '').trim(), observaciones: String(f[iAcc] || '').trim(),
      fecha_atencion: fecha, fecha_limite: fecha, permanente: perm,
      estatus: est, avance: est === 'Atendida' ? 100 : 0,
      url: String(f[iUrl] || '').trim(),
      validado_por: '', fecha_validacion: '', comentarios_director: '', fuente: 'sheet'
    });
  }
  return out;
}
