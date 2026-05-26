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
    HOJA_JEFATURAS_ID:    'PEGA_AQUI_EL_ID_DE_LA_HOJA_DE_JEFATURAS',
    HOJA_JEFATURAS_PEST:  'Jefaturas',   // nombre exacto de la pestaña

    HOJA_SUBDIR_ID:       'PEGA_AQUI_EL_ID_DE_LA_HOJA_DE_SUBDIRECCION',
    HOJA_SUBDIR_PEST:     'SPAC',

    HOJA_USUARIOS_ID:     'PEGA_AQUI_EL_ID_DE_LA_HOJA_USUARIOS',
    HOJA_USUARIOS_PEST:   'Usuarios',

    APP_HTML_URL:         'https://attrapi.github.io/TT/index.html',
    HOJA_ESTADOS_PEST:    'Estados',
    // Carpeta de Drive donde se suben los adjuntos arrastrados (debe ser
    // accesible por esta cuenta). ID que va en la URL de la carpeta.
    // Carpeta general (Director / respaldo) y una por subdirección. El adjunto
    // se guarda en la carpeta de la subdirección de quien lo sube.
    DRIVE_CARPETA_ID:     '1kF3hbcJMnFSceeAv8MXiYzNSA4yYhz2q',   // DPAC (general)
    DRIVE_CARPETA_SPAC:   '1He1CRd5FMMO563v7DeyB_SBmChbxYfmo',   // carpeta SPAC
    DRIVE_CARPETA_SA:     'PEGA_AQUI_ID_CARPETA_SA',
    DRIVE_CARPETA_SGOI:   'PEGA_AQUI_ID_CARPETA_SGOI',
    DRIVE_CARPETA_ENLACE: 'PEGA_AQUI_ID_CARPETA_ENLACE',
    HORAS_SESION:         '8'
  };
  // Solo guarda lo que SÍ llenaste: ignora los 'PEGA_AQUI...' para no borrar
  // configuración ya existente. Así re-correr esta función es seguro.
  var p = PropertiesService.getScriptProperties();
  var aplicados = [];
  Object.keys(valores).forEach(function (k) {
    var v = String(valores[k]);
    if (v.indexOf('PEGA_AQUI') === 0) return;   // placeholder sin llenar → no tocar
    p.setProperty(k, v);
    aplicados.push(k);
  });
  Logger.log('✅ Guardado: ' + aplicados.join(', '));
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
    HOJA_JEFATURAS_ID:   g('HOJA_JEFATURAS_ID'),
    HOJA_JEFATURAS_PEST: g('HOJA_JEFATURAS_PEST', 'Jefaturas'),
    HOJA_SUBDIR_ID:      g('HOJA_SUBDIR_ID'),
    HOJA_SUBDIR_PEST:    g('HOJA_SUBDIR_PEST', 'SPAC'),
    HOJA_USUARIOS_ID:    g('HOJA_USUARIOS_ID'),
    HOJA_USUARIOS_PEST:  g('HOJA_USUARIOS_PEST', 'Usuarios'),
    APP_HTML_URL:        g('APP_HTML_URL', 'https://attrapi.github.io/TT/index.html'),
    HOJA_ESTADOS_PEST:   g('HOJA_ESTADOS_PEST', 'Estados'),
    DRIVE_CARPETA_ID:     g('DRIVE_CARPETA_ID'),
    DRIVE_CARPETA_SPAC:   g('DRIVE_CARPETA_SPAC'),
    DRIVE_CARPETA_SA:     g('DRIVE_CARPETA_SA'),
    DRIVE_CARPETA_SGOI:   g('DRIVE_CARPETA_SGOI'),
    DRIVE_CARPETA_ENLACE: g('DRIVE_CARPETA_ENLACE'),
    HORAS_SESION:        Number(g('HORAS_SESION', '8'))
  };
})();
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
  var tareas = jef.concat(sub);
  aplicarEstados_(tareas);   // combina con los avances guardados (hoja Estados)
  return { ok: true, tareas: tareas };
}

// Crea una tarea NUEVA escribiendo una fila en la hoja que corresponde.
// `datos`: { subdireccion, nivel, responsable, jefatura, tema, areas,
//            acuerdos, accion, fecha (yyyy-mm-dd o 'PERMANENTE'), url }
function crearTarea(token, datos) {
  if (!sesionValida_(token)) return { ok: false, error: 'Sesión no válida.' };
  datos = datos || {};
  var sub = String(datos.subdireccion || '').toUpperCase();
  var esJef = datos.nivel === 'jefatura';

  var sheetId, sheetPest;
  if (esJef) { sheetId = CONFIG.HOJA_JEFATURAS_ID; sheetPest = CONFIG.HOJA_JEFATURAS_PEST; }
  else if (sub === 'SPAC') { sheetId = CONFIG.HOJA_SUBDIR_ID; sheetPest = CONFIG.HOJA_SUBDIR_PEST; }
  else { return { ok: false, error: 'Aún no hay una hoja configurada para la subdirección ' + sub + '.' }; }

  var ss = SpreadsheetApp.openById(sheetId);
  var hoja = ss.getSheetByName(sheetPest);
  if (!hoja) return { ok: false, error: 'No existe la pestaña destino "' + sheetPest + '".' };

  var valores = hoja.getDataRange().getValues();
  var e = -1;
  for (var i = 0; i < valores.length; i++) { if (norm_(valores[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return { ok: false, error: 'No se encontró el encabezado (ID) en la hoja.' };

  var enc = valores[e].map(norm_);
  var fila = [];
  for (var c = 0; c < enc.length; c++) fila.push('');
  function set(nombre, val) {
    var idx = enc.indexOf(nombre);
    if (idx < 0) idx = enc.findIndex(function (h) { return h.indexOf(nombre) >= 0; });
    if (idx >= 0) fila[idx] = val;
  }
  // Fecha: la app manda yyyy-mm-dd; la hoja usa dd/mm/yyyy.
  var fecha = String(datos.fecha || '');
  var mm = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mm) fecha = mm[3] + '/' + mm[2] + '/' + mm[1];

  set('id', siguienteIdSheet_(valores, e, esJef ? 'SPACJ-' : 'SPAC-'));   // ID FIJO
  set('responsable', datos.responsable || '');
  if (esJef) set('jefatura', datos.jefatura || '');
  set('tema', datos.tema || '');
  set('areas', datos.areas || '');
  set('acuerdos realizados', datos.acuerdos || '');
  set('accion', datos.accion || '');
  set('fecha', fecha);
  set('estatus', 'En Proceso');
  set('url', datos.url || '');

  hoja.appendRow(fila);
  agregarAreas_(datos.areas);   // registra áreas nuevas (las escritas en "Otra")
  return { ok: true };
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

// Asigna IDs fijos a las filas que aún no lo tienen (córrela UNA vez para
// migrar las tareas existentes). Después, crear/editar/eliminar usan ese ID.
function asignarIds() {
  var hechos = 0;
  [{ id: CONFIG.HOJA_JEFATURAS_ID, pest: CONFIG.HOJA_JEFATURAS_PEST, pre: 'SPACJ-' },
   { id: CONFIG.HOJA_SUBDIR_ID, pest: CONFIG.HOJA_SUBDIR_PEST, pre: 'SPAC-' }].forEach(function (h) {
    var ss = SpreadsheetApp.openById(h.id);
    var hoja = ss.getSheetByName(h.pest);
    if (!hoja) return;
    var vals = hoja.getDataRange().getValues();
    var e = -1;
    for (var i = 0; i < vals.length; i++) { if (norm_(vals[i][0]) === 'id') { e = i; break; } }
    if (e < 0) return;
    var iTema = vals[e].map(norm_).indexOf('tema');
    var max = 0;
    for (var r = e + 1; r < vals.length; r++) {
      var v = String(vals[r][0] || '').trim();
      if (v.indexOf(h.pre) === 0) { var n = parseInt(v.slice(h.pre.length), 10); if (!isNaN(n) && n > max) max = n; }
    }
    for (var r2 = e + 1; r2 < vals.length; r2++) {
      if (!String(vals[r2][iTema] || '').trim()) continue;
      if (/^SPACJ?-\d+/i.test(String(vals[r2][0] || '').trim())) continue;
      max++;
      hoja.getRange(r2 + 1, 1).setValue(h.pre + String(max).padStart(3, '0'));
      hechos++;
    }
  });
  Logger.log('✅ IDs fijos asignados: ' + hechos);
  return { ok: true, asignados: hechos };
}

// Actualiza (edita) una tarea existente. Mismos permisos que eliminar.
function actualizarTarea(token, id, datos) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  datos = datos || {};
  id = String(id || '').trim();
  var esJef = id.indexOf('SPACJ-') === 0;
  var esSub = id.indexOf('SPAC-') === 0 && !esJef;
  if (!esJef && !esSub) return { ok: false, error: 'Esa subdirección aún no tiene hoja configurada.' };
  if (!(sesion.rol === 'Capturista' && sesion.subdireccion === 'SPAC')) return { ok: false, error: 'No tienes permiso para editar esta tarea.' };

  var sheetId = esJef ? CONFIG.HOJA_JEFATURAS_ID : CONFIG.HOJA_SUBDIR_ID;
  var sheetPest = esJef ? CONFIG.HOJA_JEFATURAS_PEST : CONFIG.HOJA_SUBDIR_PEST;
  var ss = SpreadsheetApp.openById(sheetId);
  var hoja = ss.getSheetByName(sheetPest);
  if (!hoja) return { ok: false, error: 'No existe la pestaña destino.' };
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
  agregarAreas_(datos.areas);
  return { ok: true };
}

// Elimina una tarea (borra su fila del Sheet). Solo el Subdirector de SPAC
// (sus tareas de subdirección y de jefatura). La fila se ubica por ID fijo.
function eliminarTarea(token, id) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  id = String(id || '').trim();

  var esJef = id.indexOf('SPACJ-') === 0;
  var esSub = id.indexOf('SPAC-') === 0 && !esJef;
  if (!esJef && !esSub) return { ok: false, error: 'Esa subdirección aún no tiene hoja configurada.' };

  // Las tareas SPAC (subdirección y jefatura) solo las borra el Subdirector de
  // SPAC. El Director solo borra sus propias tareas (DPAC) y las de Enlace, que
  // aún no tienen hoja configurada.
  var taskSub = 'SPAC';
  var permitido = (sesion.rol === 'Capturista' && sesion.subdireccion === taskSub);
  if (!permitido) return { ok: false, error: 'No tienes permiso para eliminar esta tarea.' };

  var sheetId = esJef ? CONFIG.HOJA_JEFATURAS_ID : CONFIG.HOJA_SUBDIR_ID;
  var sheetPest = esJef ? CONFIG.HOJA_JEFATURAS_PEST : CONFIG.HOJA_SUBDIR_PEST;
  var ss = SpreadsheetApp.openById(sheetId);
  var hoja = ss.getSheetByName(sheetPest);
  if (!hoja) return { ok: false, error: 'No existe la pestaña destino.' };

  var valores = hoja.getDataRange().getValues();
  var e = -1;
  for (var i = 0; i < valores.length; i++) { if (norm_(valores[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return { ok: false, error: 'No se encontró el encabezado (ID).' };

  var filaSheet = localizarFila_(valores, e, id);
  if (filaSheet < 0) return { ok: false, error: 'No se encontró la fila de la tarea.' };

  hoja.deleteRow(filaSheet);
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
  'Enlace del Director'
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
function carpetaDe_(subdireccion) {
  var m = {
    SPAC: CONFIG.DRIVE_CARPETA_SPAC,
    SA: CONFIG.DRIVE_CARPETA_SA,
    SGOI: CONFIG.DRIVE_CARPETA_SGOI,
    ENLACE: CONFIG.DRIVE_CARPETA_ENLACE
  };
  var id = m[subdireccion];
  return (id && String(id).trim()) ? id : CONFIG.DRIVE_CARPETA_ID;
}

// Sube un archivo (en base64) a la carpeta de la subdirección del usuario y
// devuelve su enlace. Lo usa el arrastrar-y-soltar del formulario de nueva tarea.
function subirArchivo(token, nombre, mime, base64) {
  var sesion = sesionValida_(token);
  if (!sesion) return { ok: false, error: 'Sesión no válida.' };
  var carpetaId = carpetaDe_(sesion.subdireccion);
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

// ====================== ESTADOS (guardar avances) =========================
// La hoja Estados vive en el mismo archivo que Usuarios.
function estadosSpreadsheetId_() { return CONFIG.HOJA_USUARIOS_ID; }
function estadosPestana_() { return CONFIG.HOJA_ESTADOS_PEST || 'Estados'; }
var ESTADOS_HEADERS = ['ID', 'Estatus', 'Validada', 'EnValidadas', 'FinalizadoPor', 'FechaFinalizacion', 'ValidadoPor', 'FechaValidacion', 'ActualizadoPor', 'ActualizadoEn', 'Comentario'];

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
  } else if (datos[0].map(norm_).indexOf('comentario') === -1) {
    // Hoja creada antes de agregar la columna Comentario: repara el encabezado.
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
    e.comentario_devolucion || ''
  ];
  var rowIndex = -1;
  for (var r = 1; r < datos.length; r++) {
    if (String(datos[r][0]).trim() === String(id).trim()) { rowIndex = r + 1; break; }
  }
  if (rowIndex > 0) hoja.getRange(rowIndex, 1, 1, fila.length).setValues([fila]);
  else hoja.appendRow(fila);
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
        iVp = enc.indexOf('validadopor'), iFv = enc.indexOf('fechavalidacion'), iCom = enc.indexOf('comentario');
    var map = {};
    for (var r = 1; r < datos.length; r++) {
      var f = datos[r], id = String(f[iId] || '').trim();
      if (!id) continue;
      map[id] = {
        estatus: String(f[iEst] || '').trim(),
        validada: norm_(f[iVal]) === 'si',
        en_validadas: norm_(f[iEnV]) === 'si',
        finalizado_por: String(f[iFp] || '').trim(),
        fecha_finalizacion: String(f[iFf] || '').trim(),
        validado_por: String(f[iVp] || '').trim(),
        fecha_validacion: String(f[iFv] || '').trim(),
        comentario_devolucion: iCom >= 0 ? String(f[iCom] || '').trim() : ''
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
    t.avance = (t.estatus === 'Atendida' || t.estatus === 'Archivada') ? 100 : t.avance;
  });
}

function ahoraStamp_() {
  var a = new Date();
  return a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0') + '-' + String(a.getDate()).padStart(2, '0') +
    ' ' + String(a.getHours()).padStart(2, '0') + ':' + String(a.getMinutes()).padStart(2, '0');
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
  hoja.appendRow([
    ent.fecha || ahoraStamp_(), ent.usuario || '', ent.accion || '', ent.id_tarea || '',
    ent.estatus_anterior || '', ent.estatus_nuevo || '', ent.comentario || ''
  ]);
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
      fecha: String(f[iF] || ''), usuario: String(f[iU] || ''), accion: String(f[iA] || ''),
      id_tarea: String(f[iId] || ''), estatus_anterior: String(f[iEa] || ''),
      estatus_nuevo: String(f[iEn] || ''), comentario: String(iC >= 0 ? f[iC] || '' : '')
    });
  }
  return { ok: true, bitacora: out.reverse() };   // más reciente primero
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
    // ID FIJO: usa el de la columna ID si ya es estable (SPAC-### / SPACJ-###);
    // si está vacío o es un número suelto, usa el posicional como respaldo.
    var idCell = String(f[0] || '').trim();
    var id = /^SPACJ?-\d+/i.test(idCell) ? idCell : (prefijo + String(r - e).padStart(3, '0'));
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
