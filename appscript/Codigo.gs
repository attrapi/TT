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
    DRIVE_CARPETA_ID:     '1eG1a2hO1zs5DIdUUJxRGmRlmA3EFPDiq',
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
    DRIVE_CARPETA_ID:    g('DRIVE_CARPETA_ID'),
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
  return { ok: true };
}

// Sube un archivo (en base64) a la carpeta de Drive configurada y devuelve su
// enlace. Lo usa el arrastrar-y-soltar del formulario de nueva tarea.
function subirArchivo(token, nombre, mime, base64) {
  if (!sesionValida_(token)) return { ok: false, error: 'Sesión no válida.' };
  if (!CONFIG.DRIVE_CARPETA_ID) return { ok: false, error: 'Falta configurar la carpeta de Drive.' };
  try {
    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, mime || 'application/octet-stream', nombre || 'adjunto');
    var carpeta = DriveApp.getFolderById(CONFIG.DRIVE_CARPETA_ID);
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
var ESTADOS_HEADERS = ['ID', 'Estatus', 'Validada', 'EnValidadas', 'FinalizadoPor', 'FechaFinalizacion', 'ValidadoPor', 'FechaValidacion', 'ActualizadoPor', 'ActualizadoEn'];

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
    ahoraStamp_()
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
        iVp = enc.indexOf('validadopor'), iFv = enc.indexOf('fechavalidacion');
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
        fecha_validacion: String(f[iFv] || '').trim()
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
    t.avance = (t.estatus === 'Atendida' || t.estatus === 'Archivada') ? 100 : t.avance;
  });
}

function ahoraStamp_() {
  var a = new Date();
  return a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0') + '-' + String(a.getDate()).padStart(2, '0') +
    ' ' + String(a.getHours()).padStart(2, '0') + ':' + String(a.getMinutes()).padStart(2, '0');
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
