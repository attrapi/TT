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

    // Hoja de la Dirección (DPAC): tareas propias del Director.
    HOJA_DPAC_ID:         '1uJaxAg2GMdjiaeTFdyeqfCPTKW290UNu0orp1F83XWk',
    HOJA_DPAC_PEST:       'DPAC',          // nombre exacto de la pestaña

    // Hoja del Enlace del Director.
    HOJA_ENLACE_ID:       '16D_ngkurWeGS3nM2ewhUVgINvyKU_LXx2wYIxIA8QP0',
    HOJA_ENLACE_PEST:     'Enlace',        // si no existe, usa la 1a pestaña

    // Hoja de la Subdirección de Gestión de Obras Inducidas (SGOI · Fabiola).
    HOJA_SGOI_ID:         '1Dap06TzpYoKnPKmRiDowRFO1EsHyJZHHbOsg7lod70s',
    HOJA_SGOI_PEST:       'SGOI',          // si no existe, usa la 1a pestaña

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
    HOJA_DPAC_ID:        g('HOJA_DPAC_ID'),
    HOJA_DPAC_PEST:      g('HOJA_DPAC_PEST', 'DPAC'),
    HOJA_ENLACE_ID:      g('HOJA_ENLACE_ID'),
    HOJA_ENLACE_PEST:    g('HOJA_ENLACE_PEST', 'Enlace'),
    HOJA_SGOI_ID:        g('HOJA_SGOI_ID'),
    HOJA_SGOI_PEST:      g('HOJA_SGOI_PEST', 'SGOI'),
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
  var jef = parsearHoja_(leerHoja_(CONFIG.HOJA_JEFATURAS_ID, CONFIG.HOJA_JEFATURAS_PEST), 'jefatura', 'SPAC');
  var sub = parsearHoja_(leerHoja_(CONFIG.HOJA_SUBDIR_ID,    CONFIG.HOJA_SUBDIR_PEST),    'subdireccion', 'SPAC');
  var tareas = jef.concat(sub);
  // Tareas propias de la Dirección (DPAC), si la hoja está configurada.
  if (CONFIG.HOJA_DPAC_ID) {
    try {
      var dpac = parsearHoja_(leerHoja_(CONFIG.HOJA_DPAC_ID, CONFIG.HOJA_DPAC_PEST), 'subdireccion', 'DPAC');
      tareas = tareas.concat(dpac);
    } catch (e) { /* hoja DPAC aún no lista: se ignora */ }
  }
  // Tareas del Enlace del Director, si su hoja está configurada.
  if (CONFIG.HOJA_ENLACE_ID) {
    try {
      var enl = parsearHoja_(leerHoja_(CONFIG.HOJA_ENLACE_ID, CONFIG.HOJA_ENLACE_PEST), 'subdireccion', 'ENLACE');
      tareas = tareas.concat(enl);
    } catch (e) { /* hoja Enlace aún no lista: se ignora */ }
  }
  // Tareas de la Subdirección de Gestión de Obras Inducidas (Fabiola).
  if (CONFIG.HOJA_SGOI_ID) {
    try {
      var sgoi = parsearHoja_(leerHoja_(CONFIG.HOJA_SGOI_ID, CONFIG.HOJA_SGOI_PEST), 'subdireccion', 'SGOI');
      tareas = tareas.concat(sgoi);
    } catch (e) { /* hoja SGOI aún no lista: se ignora */ }
  }
  aplicarEstados_(tareas);   // combina con los avances guardados (hoja Estados)
  return { ok: true, tareas: tareas };
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

  var sheetId, sheetPest;
  if (esJef) { sheetId = CONFIG.HOJA_JEFATURAS_ID; sheetPest = CONFIG.HOJA_JEFATURAS_PEST; }
  else if (sub === 'SPAC') { sheetId = CONFIG.HOJA_SUBDIR_ID; sheetPest = CONFIG.HOJA_SUBDIR_PEST; }
  else if (sub === 'DPAC' && CONFIG.HOJA_DPAC_ID) { sheetId = CONFIG.HOJA_DPAC_ID; sheetPest = CONFIG.HOJA_DPAC_PEST; }
  else if (sub === 'ENLACE' && CONFIG.HOJA_ENLACE_ID) { sheetId = CONFIG.HOJA_ENLACE_ID; sheetPest = CONFIG.HOJA_ENLACE_PEST; }
  else if (sub === 'SGOI' && CONFIG.HOJA_SGOI_ID) { sheetId = CONFIG.HOJA_SGOI_ID; sheetPest = CONFIG.HOJA_SGOI_PEST; }
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

  var nuevoId = siguienteIdSheet_(valores, e, esJef ? prefijoJef_(datos.jefatura) : (sub + '-'));
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
  var estIni = estatusInicial_(datos.nivel, sub);
  set('estatus', estIni);
  set('url', datos.url || '');

  hoja.appendRow(fila);
  agregarAreas_(datos.areas);   // registra áreas nuevas (las escritas en "Otra")

  // Seguimiento: guarda QUIÉN creó la tarea (hoja Estados) y déjalo en bitácora.
  var autor = sesion.nombre || sesion.email || '';
  var stamp = ahoraStamp_();
  try { guardarEstado(token, nuevoId, { creado_por: autor, fecha_creacion: stamp }); } catch (e2) {}
  try { registrarBitacora(token, { fecha: stamp, usuario: autor, accion: 'crear', id_tarea: nuevoId, estatus_anterior: '—', estatus_nuevo: estIni }); } catch (e3) {}

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

// Asigna IDs fijos a las filas que aún no lo tienen (córrela UNA vez para
// migrar las tareas existentes). Después, crear/editar/eliminar usan ese ID.
function asignarIds() {
  var hechos = 0;
  [{ id: CONFIG.HOJA_JEFATURAS_ID, pest: CONFIG.HOJA_JEFATURAS_PEST, pre: 'JSPAC-' },
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
      if (/^(?:JDPC|JDIMA|JSPAC|SPACJ|SPAC)-\d+/i.test(String(vals[r2][0] || '').trim())) continue;
      max++;
      hoja.getRange(r2 + 1, 1).setValue(h.pre + String(max).padStart(3, '0'));
      hechos++;
    }
  });
  Logger.log('✅ IDs fijos asignados: ' + hechos);
  return { ok: true, asignados: hechos };
}

// Migra los IDs de jefatura al nuevo prefijo JSPAC-### y limpia sufijos viejos
// (p. ej. "SPACJ-001.jef.procedimientos" -> "JSPAC-001"). Conserva el número
// cuando existe. Reajusta también las hojas Estados y Bitacora para no perder el
// avance ni el historial. Córrela UNA vez después de actualizar el código.
function migrarIdsJefatura() {
  var ss = SpreadsheetApp.openById(CONFIG.HOJA_JEFATURAS_ID);
  var hoja = ss.getSheetByName(CONFIG.HOJA_JEFATURAS_PEST);
  if (!hoja) return { ok: false, error: 'No existe la hoja de jefaturas.' };
  var vals = hoja.getDataRange().getValues();
  var e = -1;
  for (var i = 0; i < vals.length; i++) { if (norm_(vals[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return { ok: false, error: 'No se encontró el encabezado (ID) en la hoja de jefaturas.' };
  var iTema = vals[e].map(norm_).indexOf('tema');

  var mapa = {}, usados = {}, max = 0;
  // Calcula el número máximo ya presente (para asignar los faltantes después).
  for (var r = e + 1; r < vals.length; r++) {
    var mm0 = String(vals[r][0] || '').trim().match(/-0*(\d+)/);
    if (mm0) { var n0 = parseInt(mm0[1], 10); if (!isNaN(n0) && n0 > max) max = n0; }
  }
  var cambios = 0;
  for (var r2 = e + 1; r2 < vals.length; r2++) {
    if (iTema >= 0 && !String(vals[r2][iTema] || '').trim()) continue;   // fila vacía
    var oldId = String(vals[r2][0] || '').trim();
    var mm = oldId.match(/-0*(\d+)/);
    var num;
    if (mm && !usados[parseInt(mm[1], 10)]) num = parseInt(mm[1], 10);
    else num = ++max;
    usados[num] = true;
    if (num > max) max = num;
    var newId = 'JSPAC-' + String(num).padStart(3, '0');
    if (oldId === newId) continue;                 // ya está bien
    hoja.getRange(r2 + 1, 1).setValue(newId);
    if (oldId) mapa[oldId] = newId;                // para reajustar Estados/Bitacora
    cambios++;
  }

  var renEstados = renombrarEnHoja_(hojaEstados_(false), 0, mapa);    // col ID
  var renBitacora = renombrarEnHoja_(hojaBitacora_(false), 3, mapa);  // col IdTarea
  Logger.log('✅ Migración JSPAC: IDs=' + cambios + ', Estados=' + renEstados + ', Bitacora=' + renBitacora);
  return { ok: true, ids: cambios, estados: renEstados, bitacora: renBitacora };
}

// Reasigna TODOS los IDs de jefatura desde cero, según la jefatura de cada fila:
//   • Procesos de Construcción      → JDPC-001, JDPC-002, ...
//   • Implementación de Manuales    → JDIMA-001, JDIMA-002, ...
// Borra los IDs actuales de la hoja de jefaturas y los vuelve a asignar fijos.
// Reajusta Estados y Bitacora (viejo -> nuevo) para no perder avance ni
// historial. CÓRRELA UNA VEZ después de actualizar el código.
function reasignarIdsJefatura() {
  var ss = SpreadsheetApp.openById(CONFIG.HOJA_JEFATURAS_ID);
  var hoja = ss.getSheetByName(CONFIG.HOJA_JEFATURAS_PEST);
  if (!hoja) return { ok: false, error: 'No existe la hoja de jefaturas.' };
  var vals = hoja.getDataRange().getValues();
  var e = -1;
  for (var i = 0; i < vals.length; i++) { if (norm_(vals[i][0]) === 'id') { e = i; break; } }
  if (e < 0) return { ok: false, error: 'No se encontró el encabezado (ID) en la hoja de jefaturas.' };
  var enc = vals[e].map(norm_);
  var iTema = enc.indexOf('tema');
  var iResp = enc.indexOf('responsable');
  // Columna "Jefatura": exacta y, si no, la primera cuyo encabezado la contenga.
  var iJef = enc.indexOf('jefatura');
  if (iJef < 0) iJef = enc.findIndex(function (c) { return c.indexOf('jefatura') >= 0; });
  var iAreas = enc.findIndex(function (c) { return c.indexOf('areas') >= 0; });

  var mapa = {}, cont = { JDPC: 0, JDIMA: 0 }, cambios = 0, detalle = [];
  for (var r = e + 1; r < vals.length; r++) {
    if (iTema >= 0 && !String(vals[r][iTema] || '').trim()) continue;   // fila vacía
    // Clasifica por la COLUMNA "Jefatura" (solo usa "Áreas" si está vacía).
    var jefCol = String(iJef >= 0 ? vals[r][iJef] : '').trim();
    var jef = detectarJefatura_(jefCol || String(iAreas >= 0 ? vals[r][iAreas] : ''));
    var pre = (jef === 'MANUALES') ? 'JDIMA' : 'JDPC';
    var newId = pre + '-' + String(++cont[pre]).padStart(3, '0');
    var oldId = String(vals[r][0] || '').trim();
    hoja.getRange(r + 1, 1).setValue(newId);
    if (oldId && oldId !== newId) mapa[oldId] = newId;   // para reajustar Estados/Bitacora
    cambios++;
    detalle.push((oldId || '(sin id)') + ' → ' + newId + '  | Resp: ' + String(iResp >= 0 ? vals[r][iResp] : '') +
      '  | Jefatura leída: "' + jefCol + '" → ' + jef);
  }

  var renEstados = renombrarEnHoja_(hojaEstados_(false), 0, mapa);
  var renBitacora = renombrarEnHoja_(hojaBitacora_(false), 3, mapa);
  Logger.log('Columna Jefatura usada: índice ' + iJef + ' (encabezado "' + (iJef >= 0 ? vals[e][iJef] : '—') + '")');
  Logger.log(detalle.join('\n'));
  Logger.log('✅ Reasignación jefatura: JDPC=' + cont.JDPC + ', JDIMA=' + cont.JDIMA + ', Estados=' + renEstados + ', Bitacora=' + renBitacora);
  return { ok: true, jdpc: cont.JDPC, jdima: cont.JDIMA, estados: renEstados, bitacora: renBitacora, detalle: detalle };
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
  if (/^(?:JDPC|JDIMA|JSPAC|SPACJ)-/i.test(id)) return { sheetId: CONFIG.HOJA_JEFATURAS_ID, sheetPest: CONFIG.HOJA_JEFATURAS_PEST, sub: 'SPAC', esJef: true };
  if (/^SPAC-/i.test(id))                       return { sheetId: CONFIG.HOJA_SUBDIR_ID,    sheetPest: CONFIG.HOJA_SUBDIR_PEST,    sub: 'SPAC', esJef: false };
  if (/^DPAC-/i.test(id) && CONFIG.HOJA_DPAC_ID) return { sheetId: CONFIG.HOJA_DPAC_ID,     sheetPest: CONFIG.HOJA_DPAC_PEST,     sub: 'DPAC', esJef: false };
  if (/^ENLACE-/i.test(id) && CONFIG.HOJA_ENLACE_ID) return { sheetId: CONFIG.HOJA_ENLACE_ID, sheetPest: CONFIG.HOJA_ENLACE_PEST, sub: 'ENLACE', esJef: false };
  if (/^SGOI-/i.test(id)   && CONFIG.HOJA_SGOI_ID)   return { sheetId: CONFIG.HOJA_SGOI_ID,   sheetPest: CONFIG.HOJA_SGOI_PEST,   sub: 'SGOI',   esJef: false };
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

// Mapea código de subdirección (SPAC/SA/SGOI/DPAC/ENLACE) a su hoja destino.
// Devuelve null si no hay hoja configurada para esa subdirección.
function subToDest_(sub) {
  sub = String(sub || '').toUpperCase();
  if (sub === 'SPAC')   return { sheetId: CONFIG.HOJA_SUBDIR_ID,   sheetPest: CONFIG.HOJA_SUBDIR_PEST,   sub: 'SPAC',   esJef: false };
  if (sub === 'DPAC'   && CONFIG.HOJA_DPAC_ID)   return { sheetId: CONFIG.HOJA_DPAC_ID,   sheetPest: CONFIG.HOJA_DPAC_PEST,   sub: 'DPAC',   esJef: false };
  if (sub === 'ENLACE' && CONFIG.HOJA_ENLACE_ID) return { sheetId: CONFIG.HOJA_ENLACE_ID, sheetPest: CONFIG.HOJA_ENLACE_PEST, sub: 'ENLACE', esJef: false };
  if (sub === 'SGOI'   && CONFIG.HOJA_SGOI_ID)   return { sheetId: CONFIG.HOJA_SGOI_ID,   sheetPest: CONFIG.HOJA_SGOI_PEST,   sub: 'SGOI',   esJef: false };
  return null;
}

// Mueve una tarea de su hoja origen a una hoja destino: lee la fila, crea una
// nueva fila en destino con un ID nuevo (prefijo de la subdir destino), borra
// la fila origen y renombra el registro en Estados/Bitácora.
function moverTareaEntreHojas_(idViejo, destOrig, destNuevo, datos) {
  var ssO = SpreadsheetApp.openById(destOrig.sheetId);
  var hO = ssO.getSheetByName(destOrig.sheetPest);
  if (!hO) return { ok: false, error: 'Hoja origen no existe.' };
  var valOrig = hO.getDataRange().getValues();
  var eO = -1;
  for (var i = 0; i < valOrig.length; i++) { if (norm_(valOrig[i][0]) === 'id') { eO = i; break; } }
  if (eO < 0) return { ok: false, error: 'Encabezado origen no encontrado.' };
  var filaOrigIdx = localizarFila_(valOrig, eO, idViejo);
  if (filaOrigIdx < 0) return { ok: false, error: 'Tarea no encontrada en origen.' };
  var encOrig = valOrig[eO].map(norm_);
  var filaOrig = valOrig[filaOrigIdx - 1];

  var ssN = SpreadsheetApp.openById(destNuevo.sheetId);
  var hN = ssN.getSheetByName(destNuevo.sheetPest);
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

// Prefijo de ID según la jefatura:
//   • Procesos de Construcción (PROCEDIMIENTOS)          → JDPC-
//   • Implementación de Manuales Admin. (MANUALES)       → JDIMA-
function prefijoJef_(jefatura) { return jefatura === 'MANUALES' ? 'JDIMA-' : 'JDPC-'; }

// Regex que reconoce un ID estable (incluye prefijos viejos por compatibilidad).
var RE_ID_ESTABLE = /^(?:JDPC|JDIMA|JSPAC|SPACJ|SPAC|DPAC|ENLACE|SA|SGOI)-\d+/i;

// Estatus inicial de una tarea según su origen (lo guardado en Estados lo
// sobreescribe): jefatura y tareas propias del Director (DPAC/Enlace) nacen
// "En Proceso"; las demás subdirecciones nacen "Atendida" (Para validar).
function estatusInicial_(nivel, sub) {
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
function parsearHoja_(filas, nivel, subCode) {
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
    // La jefatura define el prefijo del ID (JDPC- / JDIMA-). Se toma de la
    // COLUMNA "Jefatura"; solo si está vacía se usa "Áreas" como respaldo.
    var textoJef = String(iJef >= 0 ? f[iJef] : '').trim();
    var jefatura = nivel === 'jefatura'
      ? detectarJefatura_(textoJef || String(f[iAreas] || ''))
      : '';
    var prefijo = nivel === 'jefatura' ? prefijoJef_(jefatura) : (subCode + '-');
    // ID FIJO: usa el de la columna ID si ya es estable; si no, usa el posicional.
    var idCell = String(f[0] || '').trim();
    var id = RE_ID_ESTABLE.test(idCell) ? idCell : (prefijo + String(r - e).padStart(3, '0'));
    // Estatus inicial por origen (lo guardado en Estados lo sobreescribe). Si la
    // hoja marca 'Archivada' explícitamente, se respeta.
    var estHoja = normEstatus_(f[iEst]);
    // En el Enlace, "Atendida" en el Excel significa VALIDADA (→ Validadas).
    var est = (estHoja === 'Archivada' || (subCode === 'ENLACE' && estHoja === 'Atendida'))
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
