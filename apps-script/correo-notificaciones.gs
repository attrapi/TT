/* =====================================================================
 *  TT · Apps Script "correo-notificaciones"
 *  Envía los avisos de tarea DESDE la cuenta dueña de este script.
 *
 *  IMPORTANTE: crea/abre este proyecto logueado como
 *      tt.notificaciones@gmail.com
 *  porque GmailApp manda SIEMPRE desde la cuenta dueña del script. Esa
 *  es justo la dirección que queremos como remitente.
 *
 *  Publicar:  Implementar ▸ Nueva implementación ▸ Aplicación web
 *      - Ejecutar como:  Yo (tt.notificaciones@gmail.com)
 *      - Quién tiene acceso:  Cualquier usuario
 *  Copia la URL .../exec y pásamela para conectarla en la app.
 *
 *  Recibe (POST, JSON):
 *      { accion:'correo', para, asunto, cuerpo, deNombre, replyTo }
 *  'para' puede traer varios correos separados por coma.
 * ===================================================================== */

// Nombre visible del remitente (lo que ve el destinatario junto al correo).
var NOMBRE_REMITENTE = 'TT · Notificaciones';

function doPost(e) {
  try {
    var datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (datos.accion !== 'correo') return _json({ ok: false, error: 'accion no soportada' });

    var para = String(datos.para || '').split(',')
      .map(function (x) { return x.trim(); }).filter(Boolean);
    if (!para.length) return _json({ ok: false, error: 'sin destinatarios' });

    var opciones = { name: datos.deNombre || NOMBRE_REMITENTE };
    if (datos.replyTo) opciones.replyTo = String(datos.replyTo).trim();
    // Copia de conocimiento (p. ej. a quien crea la tarea). Se omite cualquier
    // correo que ya esté en "Para" (no tiene caso duplicarlo).
    if (datos.cc) {
      var cc = String(datos.cc).split(',').map(function (x) { return x.trim(); })
        .filter(function (x) { return x && para.indexOf(x) < 0; });
      if (cc.length) opciones.cc = cc.join(',');
    }

    GmailApp.sendEmail(
      para.join(','),
      String(datos.asunto || '(sin asunto)'),
      String(datos.cuerpo || ''),
      opciones
    );
    return _json({ ok: true, enviados: para });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// Permite probar la URL en el navegador (GET) sin enviar nada.
function doGet() {
  return _json({ ok: true, servicio: 'correo-notificaciones', viva: true });
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
