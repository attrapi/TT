/* =====================================================================
   TT · RESPALDO DIARIO DE SUPABASE A GOOGLE DRIVE
   Cada noche exporta las tablas de la base a archivos JSON dentro de una
   carpeta "Respaldos TT" en Mi unidad (una subcarpeta por día, AAAA-MM-DD)
   y borra los respaldos de más de 30 días. Todo es texto: cada foto pesa
   unos cuantos MB a lo mucho; el peso total se mantiene estable.

   CÓMO SE INSTALA (una sola vez):
   1) En el proyecto de Apps Script (el mismo de los adjuntos), crear un
      archivo nuevo "Respaldo" y pegar este código.
   2) Configuración del proyecto (engrane) → Propiedades del script →
      agregar la propiedad:
        SUPABASE_SERVICE_KEY = la "service_role key" de Supabase
        (Supabase → Settings → API keys → service_role · secret).
      ⚠️ Esa llave abre TODA la base saltándose la seguridad: va SOLO ahí,
      NUNCA en el código, en el repo ni en el navegador.
   3) Ejecutar una vez probarRespaldo() (autorizar permisos) y revisar en
      Drive que la carpeta "Respaldos TT" tenga la foto de hoy.
   4) Ejecutar una vez crearDisparadorDiario() → queda programado a diario
      entre 3 y 4 am.

   PARA RESTAURAR: cada archivo AAAA-MM-DD/tabla.json es la tabla completa
   de ese día, tal cual la regresa la API. Se puede re-subir por REST o
   pedirle a Claude que arme el script de restauración con el archivo.
   ===================================================================== */

const RESPALDO_SUPABASE_URL = 'https://cduqgcyktcruvxrmlkks.supabase.co';
const RESPALDO_CARPETA_NOMBRE = 'Respaldos TT';
const RESPALDO_DIAS_GUARDADOS = 30;   // fotos diarias que se conservan
const RESPALDO_PAGINA = 1000;         // filas por petición (tope de PostgREST)

// Tablas a respaldar y su columna de orden (para paginar sin brincos).
const RESPALDO_TABLAS = {
  tareas:         'codigo.asc',
  volantes:       'numero.asc',
  bitacora:       'id.asc',
  perfiles:       'id.asc',
  areas_catalogo: 'id.asc',
  juego_progreso: 'usuario_id.asc,ley.asc',
  auditoria:      'id.asc'
};

// ---- Función principal (la que corre el disparador diario) ----
function respaldoDiario() {
  const key = respaldoKey_();
  const raiz = respaldoCarpetaRaiz_();
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Subcarpeta del día (si ya existe, se reutiliza y se reemplazan los archivos).
  let carpeta;
  const ya = raiz.getFoldersByName(hoy);
  carpeta = ya.hasNext() ? ya.next() : raiz.createFolder(hoy);

  const resumen = [];
  Object.keys(RESPALDO_TABLAS).forEach(function (tabla) {
    const filas = respaldoLeerTabla_(tabla, RESPALDO_TABLAS[tabla], key);
    const nombre = tabla + '.json';
    const viejos = carpeta.getFilesByName(nombre);
    while (viejos.hasNext()) viejos.next().setTrashed(true);
    carpeta.createFile(nombre, JSON.stringify(filas), 'application/json');
    resumen.push(tabla + ': ' + filas.length + ' filas');
  });

  respaldoPurgarViejos_(raiz);
  Logger.log('Respaldo ' + hoy + ' listo. ' + resumen.join(' · '));
  return resumen;
}

// ---- Para probar a mano la primera vez ----
function probarRespaldo() {
  const resumen = respaldoDiario();
  Logger.log('Prueba OK: revisa la carpeta "' + RESPALDO_CARPETA_NOMBRE + '" en Mi unidad.');
  return resumen;
}

// ---- Programa el disparador diario (correr UNA vez) ----
function crearDisparadorDiario() {
  // Quita disparadores previos de respaldoDiario para no duplicar.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'respaldoDiario') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('respaldoDiario').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Listo: respaldo programado a diario entre 3 y 4 am.');
}

// ===================== internas =====================

function respaldoKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
  if (!key) throw new Error('Falta la propiedad SUPABASE_SERVICE_KEY en Propiedades del script (ver instrucciones arriba).');
  return key;
}

// Lee una tabla completa, paginando de RESPALDO_PAGINA en RESPALDO_PAGINA.
function respaldoLeerTabla_(tabla, orden, key) {
  const todas = [];
  let offset = 0;
  for (;;) {
    const url = RESPALDO_SUPABASE_URL + '/rest/v1/' + tabla +
      '?select=*&order=' + encodeURIComponent(orden) +
      '&limit=' + RESPALDO_PAGINA + '&offset=' + offset;
    const resp = UrlFetchApp.fetch(url, {
      headers: { apikey: key, Authorization: 'Bearer ' + key },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      throw new Error('Supabase respondió ' + resp.getResponseCode() + ' al leer "' + tabla + '": ' + resp.getContentText().slice(0, 300));
    }
    const lote = JSON.parse(resp.getContentText());
    todas.push.apply(todas, lote);
    if (lote.length < RESPALDO_PAGINA) return todas;
    offset += RESPALDO_PAGINA;
  }
}

function respaldoCarpetaRaiz_() {
  const props = PropertiesService.getScriptProperties();
  const idGuardado = props.getProperty('RESPALDO_CARPETA_ID');
  if (idGuardado) {
    try { return DriveApp.getFolderById(idGuardado); } catch (e) { /* se borró: se recrea */ }
  }
  const existentes = DriveApp.getFoldersByName(RESPALDO_CARPETA_NOMBRE);
  const carpeta = existentes.hasNext() ? existentes.next() : DriveApp.createFolder(RESPALDO_CARPETA_NOMBRE);
  props.setProperty('RESPALDO_CARPETA_ID', carpeta.getId());
  return carpeta;
}

// Manda a la papelera las subcarpetas AAAA-MM-DD con más de RESPALDO_DIAS_GUARDADOS días.
function respaldoPurgarViejos_(raiz) {
  const limite = new Date();
  limite.setDate(limite.getDate() - RESPALDO_DIAS_GUARDADOS);
  const corte = Utilities.formatDate(limite, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const sub = raiz.getFolders();
  while (sub.hasNext()) {
    const c = sub.next();
    const nombre = c.getName();
    if (/^\d{4}-\d{2}-\d{2}$/.test(nombre) && nombre < corte) c.setTrashed(true);
  }
}
