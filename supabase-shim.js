/* =====================================================================
 *  TT · Puente Supabase (shim de google.script.run)
 *  Define window.google.script.run con las MISMAS funciones del backend de
 *  Apps Script, pero por debajo habla con Supabase (Postgres + Auth). Así la
 *  interfaz actual (index.html) funciona casi igual, solo cambia el "motor".
 *  Carga: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">
 *         <script src="supabase-shim.js">  ANTES del script de la app.
 * ===================================================================== */
(function () {
  'use strict';

  // Marcador de versión del shim, para verificar en consola cuál está corriendo
  // (window.TT_SHIM_VERSION). Subir junto con el ?v= de index.html.
  window.TT_SHIM_VERSION = '20260723b';

  // ---- Configuración (la anon/publishable key es pública: va en el navegador) ----
  var SUPABASE_URL = 'https://cduqgcyktcruvxrmlkks.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_6Qhw_ZADne61Yg5-WtpMBA_XqAxnzvI';
  var DOMINIO      = '@attrapi.gob.mx';     // se agrega al usuario corto para el login
  // Mini Apps Script (solo adjuntos a Drive). Se conecta en el siguiente paso.
  var DRIVE_URL    = 'https://script.google.com/macros/s/AKfycbyZgAmAerXuSXlI3l_WAre1rLfSFt3Omt1C_48S2DUH24ySkRW0L5lIJrTVyaH-OXI6xw/exec';
  // Apps Script DEDICADO al correo, dueño = tt.notificaciones@gmail.com (el
  // remitente real es esa cuenta). Pega aquí la URL .../exec cuando lo publiques.
  // Mientras esté vacío, el correo cae al DRIVE_URL de arriba (respaldo).
  var CORREO_URL   = 'https://script.google.com/macros/s/AKfycbwiCRiXRvPJLo9iK8S2s56Aqnq5mq6Aip5J_UwXwQfKU9FrpC3JwG5zSoEuCnlpW17K/exec';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var USUARIO_ACTUAL = null;   // perfil del usuario logueado (para creado_por, etc.)

  // ---------- GUARDIÁN DE SESIÓN ----------
  // Supabase maneja SU PROPIA sesión (token) aparte del "recuerdo" de la app
  // (tt_token). Si esa sesión se vence o se cierra sola (pestaña abierta muchas
  // horas, o la app abierta en dos dispositivos que se pisan el token), la app
  // se sigue viendo logueada pero cada GUARDADO llega a la base como "anónimo",
  // y la base lo rechaza con "new row violates row-level security policy". Antes
  // eso salía como un error técnico y el usuario quedaba atorado. Ahora:
  //   1) ANTES de cada operación se renueva el token si está por vencer (evita
  //      que el problema ocurra en primer lugar).
  //   2) Si aun así una operación falla por sesión muerta, se AVISA claro
  //      ("Tu sesión venció, vuelve a entrar") y se regresa al login.

  // ¿El texto de un error huele a sesión perdida (no a un permiso legítimo)?
  function textoDeSesionMuerta(msg) {
    msg = String(msg || '').toLowerCase();
    return msg.indexOf('row-level security') >= 0
        || msg.indexOf('violates row-level') >= 0
        || msg.indexOf('jwt') >= 0
        || msg.indexOf('sin sesión') >= 0
        || msg.indexOf('sin sesion') >= 0
        || msg.indexOf('not authenticated') >= 0;
  }

  // ¿Hay de verdad una sesión válida? (si el token venció, intenta renovarlo una
  // vez). Sirve para CONFIRMAR antes de dar por muerta la sesión: así un error de
  // permiso legítimo con sesión viva NO dispara el aviso de "vencida".
  async function sesionViva() {
    try {
      var s = await sb.auth.getSession();
      var sess = s.data && s.data.session;
      if (!sess) return false;
      var exp = sess.expires_at ? sess.expires_at * 1000 : 0;
      if (exp && exp <= Date.now()) {
        var r = await sb.auth.refreshSession();
        return !!(r && r.data && r.data.session && !r.error);
      }
      return true;
    } catch (e) { return false; }
  }

  // Renueva el token de forma preventiva si le quedan menos de 2 minutos (además
  // del auto-refresco propio de supabase-js). No hace nada si no hay sesión.
  async function asegurarSesion() {
    try {
      var s = await sb.auth.getSession();
      var sess = s.data && s.data.session;
      if (!sess) return;
      var exp = sess.expires_at ? sess.expires_at * 1000 : 0;
      if (exp && (exp - Date.now()) < 120000) {
        await sb.auth.refreshSession();
      }
    } catch (e) { /* si falla, la operación real dará el error y el reactivo lo maneja */ }
  }

  // Avisa UNA sola vez a la app (window.ttSesionVencida) que la sesión murió.
  var sesionVencidaAvisada = false;
  function dispararSesionVencida() {
    if (sesionVencidaAvisada) return;   // no repetir por cada llamada que falle
    sesionVencidaAvisada = true;
    USUARIO_ACTUAL = null;
    try { if (typeof window.ttSesionVencida === 'function') window.ttSesionVencida(); } catch (e) {}
  }

  // ---------- VOLANTE REPETIDO ----------
  // La base tiene un índice único sobre upper(numero) (volantes_numero_unico),
  // así que dos volantes NO pueden llevar el mismo número — sin importar el área
  // ni quién los registró.
  // Antes esto se detectaba buscando las palabras "unique"/"duplicate" en el
  // TEXTO del error: cualquier otro problema que las mencionara se le mostraba
  // al usuario como "ya existe ese número". Ahora se mira el CÓDIGO de Postgres
  // (23505 = unique_violation) y, de respaldo, el nombre del índice.
  function esVolanteRepetido(err) {
    if (!err) return false;
    if (String(err.code || '') === '23505') return true;
    return /volantes_numero_unico/i.test(err.message || '');
  }

  // Trae el volante que YA tiene ese número, para poder decir DÓNDE está (el
  // usuario suele no verlo: la lista arranca filtrada por su propia área).
  // `exceptoId` sirve al editar: no cuenta el volante que se está guardando.
  async function volantePorNumero(numero, exceptoId) {
    try {
      // En LIKE/ILIKE, % y _ son comodines: se escapan para buscar el número tal cual.
      var patron = String(numero || '').replace(/([%_\\])/g, '\\$1');
      var q = sb.from('volantes')
        .select('id,numero,area,estatus,creado_por,created_at')
        .ilike('numero', patron).limit(1);
      if (exceptoId) q = q.neq('id', exceptoId);
      var r = await q;
      return (r.data && r.data[0]) || null;
    } catch (e) { return null; }
  }

  // "Ya existe el volante X (área SA, registrado por Fulana el 14/07/2026)."
  function mensajeRepetido(numero, fila, esOtro) {
    var m = 'Ya existe ' + (esOtro ? 'otro volante' : 'un volante') + ' con el número ' + numero;
    if (fila) {
      var det = [];
      if (fila.area) det.push('área ' + fila.area);
      if (fila.creado_por) det.push('registrado por ' + fila.creado_por);
      if (fila.created_at) {
        var d = new Date(fila.created_at);
        if (!isNaN(d.getTime())) {
          det.push('el ' + String(d.getDate()).padStart(2, '0') + '/' +
            String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear());
        }
      }
      if (det.length) m += ' (' + det.join(', ') + ')';
    }
    return m + '.';
  }

  // --- Tiempo real: cuando cambian las tareas en la base, refrescar en pantalla ---
  var canalRT = null;
  function suscribirRealtime() {
    if (canalRT) return;   // ya suscrito
    try {
      canalRT = sb.channel('tt-cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, function () {
          if (typeof window.ttRefrescar === 'function') window.ttRefrescar();
        })
        // Hilo de comentarios / vistos viven en `bitacora`: suscribir también para
        // que un comentario nuevo aparezca en vivo (requiere que la tabla esté en
        // la publicación supabase_realtime).
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora' }, function () {
          if (typeof window.ttRefrescarBitacora === 'function') window.ttRefrescarBitacora();
        })
        // Volantes (registro de SGOI): si alguien registra/edita uno, a los
        // demás les aparece sin recargar (requiere supabase/volantes.sql).
        .on('postgres_changes', { event: '*', schema: 'public', table: 'volantes' }, function () {
          if (typeof window.ttRefrescarVolantes === 'function') window.ttRefrescarVolantes();
        })
        .subscribe();
    } catch (e) { /* si realtime no está habilitado, la app sigue normal */ }
  }

  var AREAS_BASE = [
    'Dirección de Procesos Administrativos de Construcción',
    'Subdirección de Procesos Administrativos de Construcción',
    'Subdirección de Archivo',
    'Subdirección de Gestión de Obras Inducidas A',
    'Subdirección de Gestión de Obras Inducidas B',
    'Subdirección de Gestión de Obras Inducidas C',
    'Jefatura de Departamento de Procedimientos de Construcción',
    'Jefatura de Departamento de Implementación de Manuales Administrativos',
    'Jefatura de Departamento de Gestión Ambiental',
    'Jefatura de Departamento de Gestión de Obras Inducidas',
    'Staff'
  ];

  // ---------- helpers ----------
  function emailDe(usuario) {
    usuario = String(usuario || '').trim().toLowerCase();
    return usuario.indexOf('@') >= 0 ? usuario : usuario + DOMINIO;
  }
  function perfilAUsuario(p, email) {
    return {
      email: email || '',
      nombre: p ? (p.nombre || '') : '',
      rol: (p && p.rol === 'Director') ? 'Director' : 'Capturista',
      subdireccion: p ? String(p.subdireccion || '').toUpperCase() : '',
      jefatura: p ? (p.jefatura || '') : '',
      es_enlace: !!(p && p.es_enlace),
      acceso_completo: !!(p && p.acceso_completo),
      nombre_corto: p ? (p.nombre_corto || '') : '',
      // Ids de bitácora de las notificaciones que ya abrió (notificaciones.sql).
      notif_leidas: (p && Array.isArray(p.notif_leidas)) ? p.notif_leidas.map(String) : []
    };
  }
  function areaDeDatos(d) {
    if (d.nivel === 'jefatura') {
      return ({ PROCEDIMIENTOS: 'JDPC', MANUALES: 'JDIMA', GESTION_AMBIENTAL: 'JDGA', GESTION_OBRAS: 'JDGOI' })[String(d.jefatura || '').toUpperCase()] || 'JDPC';
    }
    return String(d.subdireccion || '').toUpperCase();
  }
  function fechaSql(f) {
    f = String(f || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null;
  }
  function fmtFecha(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      var p = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City',
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
      var g = {}; p.forEach(function (x) { g[x.type] = x.value; });
      return g.day + '/' + g.month + '/' + g.year + ' ' + g.hour + ':' + g.minute;
    } catch (e) { return String(iso); }
  }

  // Convierte una fila de la tabla `tareas` al objeto que la app ya entiende.
  function rowToTarea(r) {
    var fecha = r.fecha || '';
    return {
      id: r.codigo, subdireccion: r.subdireccion, nivel: r.nivel, jefatura: r.jefatura || '',
      participantes: Array.isArray(r.participantes) ? r.participantes : [],
      adjuntos: Array.isArray(r.adjuntos) ? r.adjuntos : [],
      responsable: r.responsable || '', titulo: r.tema || '', tema: r.tema || '',
      areas_involucradas: r.areas_involucradas || '',
      acuerdos_realizados: r.acuerdos || '', descripcion: r.acuerdos || '',
      accion_a_tomar: r.accion || '', observaciones: r.accion || '',
      fecha_atencion: r.permanente ? '' : fecha, fecha_limite: r.permanente ? '' : fecha, permanente: !!r.permanente,
      estatus: r.estatus || 'En Proceso', avance: (r.estatus === 'Archivada') ? 100 : 0,
      confirmada: r.confirmada !== false, url: r.url || '',
      validada: !!r.validada, en_validadas: !!r.en_validadas,
      validado_por: r.validado_por || '', fecha_validacion: r.fecha_validacion || '',
      finalizado_por: r.finalizado_por || '', fecha_finalizacion: r.fecha_finalizacion || '',
      enviado_por: r.enviado_por || '', fecha_envio: r.fecha_envio || '',
      eliminada: !!r.eliminada, eliminado_por: r.eliminado_por || '', fecha_eliminacion: r.fecha_eliminacion || '',
      creado_por: r.creado_por || '', fecha_creacion: '',
      checklist: Array.isArray(r.checklist) ? r.checklist : [],
      checklist_iniciado: !!r.checklist_iniciado,   // ya se gestionó el checklist → no re-derivar del texto
      temas: Array.isArray(r.temas) ? r.temas : [],   // píldoras de tema (SGOI); ver supabase/temas.sql
      // Tramos ferroviarios (ver supabase/proyectos.sql). `proyectos` (varios) es
      // la columna buena; `proyecto` (uno) queda para leer tareas viejas.
      proyectos: Array.isArray(r.proyectos) ? r.proyectos : (r.proyecto ? [r.proyecto] : []),
      proyecto: r.proyecto || '', tramo: r.tramo || '',
      seguimiento_en: r.seguimiento_en || '', seguimiento_por: r.seguimiento_por || '', seguimiento_acuerdo: r.seguimiento_acuerdo || '',
      observaciones_resp: r.observaciones_resp || '', observaciones_dir: r.observaciones_dir || '',
      observaciones_areas: (r.observaciones_areas && typeof r.observaciones_areas === 'object') ? r.observaciones_areas : {},
      enlaces: (r.enlaces && typeof r.enlaces === 'object' && !Array.isArray(r.enlaces))
        ? { links: Array.isArray(r.enlaces.links) ? r.enlaces.links : [], desc: r.enlaces.desc || '' }
        : { links: [], desc: '' },
      comentarios_director: '', comentario_devolucion: '', fuente: 'supabase'
    };
  }

  // ====================== BACKEND (Supabase) ======================
  var BACKEND = {
    // ---- LOGIN ----
    iniciarSesion: async function (usuario, contrasena) {
      var email = emailDe(usuario);
      var r = await sb.auth.signInWithPassword({ email: email, password: String(contrasena || '') });
      if (r.error) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
      var pf = await sb.from('perfiles').select('*').eq('id', r.data.user.id).single();
      if (pf.error || !pf.data) return { ok: false, error: 'No se encontró el perfil del usuario.' };
      if (pf.data.activo === false) { await sb.auth.signOut(); return { ok: false, error: 'Usuario inactivo.' }; }
      USUARIO_ACTUAL = perfilAUsuario(pf.data, email);
      sesionVencidaAvisada = false;   // sesión fresca: rehabilita el aviso de "vencida"
      suscribirRealtime();
      return { ok: true, token: r.data.session.access_token, usuario: USUARIO_ACTUAL };
    },
    reanudarSesion: async function (token) {
      var s = await sb.auth.getSession();
      var session = s.data && s.data.session;
      if (!session) return { ok: false };
      var pf = await sb.from('perfiles').select('*').eq('id', session.user.id).single();
      if (pf.error || !pf.data) return { ok: false };
      USUARIO_ACTUAL = perfilAUsuario(pf.data, session.user.email);
      sesionVencidaAvisada = false;   // sesión fresca: rehabilita el aviso de "vencida"
      suscribirRealtime();
      return { ok: true, token: session.access_token, usuario: USUARIO_ACTUAL };
    },
    cerrarSesion: async function () { try { await sb.auth.signOut(); } catch (e) {} return { ok: true }; },

    // ---- NOTIFICACIONES (ver supabase/notificaciones.sql) ----
    // Guarda CUÁLES notificaciones ya abrió. Va en el PERFIL, no en el
    // navegador, para que si las lees en la compu no te vuelvan a salir en el
    // teléfono. La app manda la lista ya podada, así que no crece sin fin.
    guardarNotifLeidas: async function (token, ids) {
      var s = await sb.auth.getSession();
      var uid = s.data && s.data.session && s.data.session.user && s.data.session.user.id;
      if (!uid) return { ok: false, error: 'Sin sesión.' };
      var lista = Array.isArray(ids) ? ids.map(String) : [];
      var r = await sb.from('perfiles').update({ notif_leidas: lista }).eq('id', uid);
      if (r.error) {
        if (/notif_leidas/i.test(r.error.message || '')) {
          return { ok: false, error: 'Falta correr supabase/notificaciones.sql en la base: las notificaciones leídas no se están guardando.' };
        }
        return { ok: false, error: r.error.message };
      }
      if (USUARIO_ACTUAL) USUARIO_ACTUAL.notif_leidas = lista;
      return { ok: true };
    },

    listarUsuarios: async function () {
      var r = await sb.from('perfiles').select('nombre, rol, subdireccion').eq('activo', true);
      if (r.error || !r.data) return { ok: false, usuarios: [] };
      return { ok: true, usuarios: r.data.map(function (p) {
        return { usuario: '', nombre: p.nombre || '', rol: (p.rol === 'Director') ? 'Director' : 'Capturista', subdireccion: String(p.subdireccion || '').toUpperCase() };
      }) };
    },
    listarResponsables: async function () {
      var r = await sb.from('perfiles').select('nombre, rol, subdireccion, jefatura, es_enlace, acceso_completo, nombre_corto').eq('activo', true);
      if (r.error || !r.data) return { ok: true, responsables: [] };
      var out = r.data.filter(function (p) { return p.rol !== 'Director' && (p.nombre || '').trim(); })
        .map(function (p) { return { nombreCompleto: p.nombre.trim(), subdireccion: String(p.subdireccion || '').toUpperCase(), jefatura: p.jefatura || '', es_enlace: !!p.es_enlace, acceso_completo: !!p.acceso_completo, nombre_corto: p.nombre_corto || '' }; });
      return { ok: true, responsables: out };
    },
    listarTelefonos: async function () {
      var r = await sb.from('perfiles').select('subdireccion, jefatura, telefono, nombre').eq('activo', true);
      if (r.error || !r.data) return { ok: true, telefonos: {} };
      var map = {};
      r.data.forEach(function (p) {
        var tel = String(p.telefono || '').replace(/[^0-9]/g, '');
        if (!tel) return;
        if (tel.length === 10) tel = '521' + tel;
        var k = String(p.subdireccion || '').toUpperCase() + '|' + String(p.jefatura || '').toUpperCase();
        map[k] = { telefono: tel, nombre: p.nombre || '' };
      });
      return { ok: true, telefonos: map };
    },

    // ---- TAREAS ----
    obtenerTareas: async function () {
      var r = await sb.from('tareas').select('*');
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true, tareas: (r.data || []).map(rowToTarea) };
    },
    crearTarea: async function (token, datos) {
      datos = datos || {};
      var f = String(datos.fecha || '').trim();
      var fila = {
        area: areaDeDatos(datos),
        subdireccion: String(datos.subdireccion || '').toUpperCase(),
        nivel: datos.nivel || 'subdireccion',
        jefatura: datos.jefatura || '',
        responsable: datos.responsable || '',
        tema: datos.tema || '',
        areas_involucradas: datos.areas || '',
        acuerdos: datos.acuerdos || '',
        accion: datos.accion || '',
        fecha: fechaSql(f),
        permanente: /^permanente$/i.test(f),
        estatus: 'En Proceso',
        url: datos.url || '',
        creado_por: USUARIO_ACTUAL ? USUARIO_ACTUAL.nombre : ''
      };
      // Si la app manda un código (ej. enlaces: NPF-001), se respeta; si no, el
      // trigger lo autogenera por área (SPAC-###, etc.).
      if (datos.codigo) fila.codigo = String(datos.codigo).toUpperCase();
      // Solo se incluyen si la app los manda. Así, si la columna aún no existe
      // en la base, la creación sigue funcionando.
      if (Array.isArray(datos.participantes) && datos.participantes.length) fila.participantes = datos.participantes;
      if (Array.isArray(datos.adjuntos) && datos.adjuntos.length) fila.adjuntos = datos.adjuntos;
      if (datos.enlaces && ((Array.isArray(datos.enlaces.links) && datos.enlaces.links.length) || datos.enlaces.desc)) fila.enlaces = datos.enlaces;
      if (Array.isArray(datos.temas) && datos.temas.length) fila.temas = datos.temas;
      if (Array.isArray(datos.proyectos) && datos.proyectos.length) fila.proyectos = datos.proyectos;
      if (datos.proyecto) fila.proyecto = datos.proyecto;
      if (datos.tramo) fila.tramo = datos.tramo;
      var r = await sb.from('tareas').insert(fila).select('codigo').single();
      // Si la base aún no tiene esas columnas, reintenta sin ellas (no rompe).
      if (r.error && /adjuntos|participantes|enlaces|temas|proyecto|tramo/i.test(r.error.message || '')) {
        delete fila.adjuntos; delete fila.participantes; delete fila.enlaces; delete fila.temas;
        delete fila.proyectos; delete fila.proyecto; delete fila.tramo;
        r = await sb.from('tareas').insert(fila).select('codigo').single();
      }
      if (r.error) return { ok: false, error: r.error.message };
      // La entrada de bitácora "crear" la escribe el TRIGGER trg_log_crear_tarea
      // (supabase/bitacora-crear-trigger.sql), en la misma transacción del INSERT,
      // para que nunca falte como pasó con DPAC-004. NO insertar aquí (duplicaría).
      return { ok: true, id: r.data.codigo };
    },
    actualizarTarea: async function (token, id, datos) {
      datos = datos || {};
      var upd = {};
      if (datos.responsable !== undefined) upd.responsable = datos.responsable;
      if (datos.tema !== undefined) upd.tema = datos.tema;
      if (datos.areas !== undefined) upd.areas_involucradas = datos.areas;
      if (datos.acuerdos !== undefined) upd.acuerdos = datos.acuerdos;
      if (datos.accion !== undefined) upd.accion = datos.accion;
      if (datos.url !== undefined) upd.url = datos.url;   // permite limpiarlo ('')
      if (datos.fecha !== undefined) {
        var f = String(datos.fecha || '').trim();
        upd.fecha = fechaSql(f); upd.permanente = /^permanente$/i.test(f);
      }
      if (datos.subdireccion) upd.subdireccion = String(datos.subdireccion).toUpperCase();
      if (datos.nivel) { upd.nivel = datos.nivel; upd.area = areaDeDatos(datos); upd.jefatura = (datos.nivel === 'jefatura') ? (datos.jefatura || '') : ''; }
      if (datos.participantes !== undefined) upd.participantes = Array.isArray(datos.participantes) ? datos.participantes : [];
      if (datos.adjuntos !== undefined) upd.adjuntos = Array.isArray(datos.adjuntos) ? datos.adjuntos : [];
      if (datos.enlaces !== undefined) upd.enlaces = (datos.enlaces && typeof datos.enlaces === 'object') ? datos.enlaces : { links: [], desc: '' };
      if (datos.temas !== undefined) upd.temas = Array.isArray(datos.temas) ? datos.temas : [];
      if (datos.proyectos !== undefined) upd.proyectos = Array.isArray(datos.proyectos) ? datos.proyectos : [];
      if (datos.proyecto !== undefined) upd.proyecto = String(datos.proyecto || '');   // '' = quitar el proyecto
      if (datos.tramo !== undefined) upd.tramo = String(datos.tramo || '');
      // Checklist combinado desde el editor de Acciones (al editar). Sin esto, las
      // acciones agregadas/quitadas no se guardaban (solo cambiaba `accion`).
      // Al mandar el checklist se marca como GESTIONADO: lo que quede en Editar es
      // exactamente lo que se ve en el modal, y un vacío ya NO se re-deriva del texto.
      if (datos.checklist_json !== undefined) {
        try { upd.checklist = JSON.parse(datos.checklist_json || '[]'); upd.checklist_iniciado = true; } catch (e) {}
      }
      var r = await sb.from('tareas').update(upd).eq('codigo', id);
      // Columna nueva checklist_iniciado ausente (falta correr el SQL): reintenta sin ella.
      if (r.error && /checklist_iniciado/i.test(r.error.message || '')) {
        delete upd.checklist_iniciado;
        r = await sb.from('tareas').update(upd).eq('codigo', id);
      }
      // Si la base aún no tiene esas columnas, reintenta sin ellas (no rompe).
      if (r.error && /adjuntos|participantes|enlaces|temas|proyecto|tramo/i.test(r.error.message || '')) {
        delete upd.adjuntos; delete upd.participantes; delete upd.enlaces; delete upd.temas;
        delete upd.proyectos; delete upd.proyecto; delete upd.tramo;
        r = await sb.from('tareas').update(upd).eq('codigo', id);
      }
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    eliminarTarea: async function (token, id) {
      // Borra PRIMERO la bitácora de esa tarea (mientras aún existe, para que la
      // regla de permiso la deje) y luego la tarea. Así, si el ID se reutiliza,
      // la nueva tarea no hereda el historial de la anterior.
      try { await sb.from('bitacora').delete().eq('tarea_codigo', id); } catch (e) {}
      var r = await sb.from('tareas').delete().eq('codigo', id);
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    fijarEstatusHoja: async function (token, id, valor) {
      var r = await sb.from('tareas').update({ estatus: valor }).eq('codigo', id);
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    // ---- CATÁLOGO DE TEMAS SGOI (píldoras; ver supabase/temas.sql) ----
    // La lista es compartida: si alguien agrega una píldora, le aparece a todos.
    listarTemasSgoi: async function (token) {
      var r = await sb.from('temas_sgoi').select('nombre').order('nombre');
      if (r.error) return { ok: false, error: r.error.message, temas: [] };
      return { ok: true, temas: (r.data || []).map(function (x) { return x.nombre; }) };
    },
    // Agrega una píldora nueva al catálogo. Si ya existe (mismo nombre), no
    // duplica: se devuelve ok igual y la app simplemente la selecciona.
    agregarTemaSgoi: async function (token, nombre) {
      var n = String(nombre || '').trim();
      if (!n) return { ok: false, error: 'Escribe el nombre del tema.' };
      var r = await sb.from('temas_sgoi')
        .insert({ nombre: n, creado_por: USUARIO_ACTUAL ? USUARIO_ACTUAL.nombre : '' });
      // 23505 = clave duplicada: la píldora ya estaba en el catálogo.
      if (r.error && r.error.code !== '23505') {
        if (/temas_sgoi/i.test(r.error.message || '')) {
          return { ok: false, error: 'Falta correr supabase/temas.sql en la base (catálogo de temas).' };
        }
        return { ok: false, error: r.error.message };
      }
      return { ok: true, nombre: n };
    },

    // ---- SESIÓN DE SEGUIMIENTO (repaso en junta; ver supabase/seguimiento.sql) ----
    // Marca la tarea con seguimiento (✓) + el acuerdo de la junta. Compartido en
    // la base: sobrevive recargas y todos ven lo mismo.
    marcarSeguimiento: async function (token, id, acuerdo) {
      var upd = {
        seguimiento_en: new Date().toISOString(),
        seguimiento_por: USUARIO_ACTUAL ? USUARIO_ACTUAL.nombre : '',
        seguimiento_acuerdo: String(acuerdo || '')
      };
      var r = await sb.from('tareas').update(upd).eq('codigo', id);
      if (r.error && /seguimiento_(en|por|acuerdo)/i.test(r.error.message || '')) {
        return { ok: false, error: 'Falta correr supabase/seguimiento.sql en la base (columnas de seguimiento).' };
      }
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    quitarSeguimiento: async function (token, id) {
      var r = await sb.from('tareas').update({ seguimiento_en: null, seguimiento_por: '', seguimiento_acuerdo: '' }).eq('codigo', id);
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    // Reinicia la sesión: limpia el seguimiento de las tareas indicadas (o de todas
    // si no se pasa lista). Se usa al empezar una junta nueva.
    reiniciarSeguimiento: async function (token, ids) {
      var q = sb.from('tareas').update({ seguimiento_en: null, seguimiento_por: '', seguimiento_acuerdo: '' });
      if (Array.isArray(ids) && ids.length) q = q.in('codigo', ids);
      else q = q.not('seguimiento_en', 'is', null);
      var r = await q;
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    // Guarda el avance/validación (lo que antes era la hoja Estados) en la propia fila.
    guardarEstado: async function (token, id, e) {
      e = e || {};
      var upd = {};
      if (e.estatus) upd.estatus = e.estatus;
      if (e.validada !== undefined) upd.validada = !!e.validada;
      if (e.en_validadas !== undefined) upd.en_validadas = !!e.en_validadas;
      if (e.confirmada !== undefined) upd.confirmada = (e.confirmada !== false);
      if (e.enviado_por !== undefined) upd.enviado_por = e.enviado_por || '';
      if (e.fecha_envio !== undefined) upd.fecha_envio = e.fecha_envio || '';
      if (e.finalizado_por !== undefined) upd.finalizado_por = e.finalizado_por || '';
      if (e.fecha_finalizacion !== undefined) upd.fecha_finalizacion = e.fecha_finalizacion || '';
      if (e.validado_por !== undefined) upd.validado_por = e.validado_por || '';
      if (e.fecha_validacion !== undefined) upd.fecha_validacion = e.fecha_validacion || '';
      if (e.eliminada !== undefined) upd.eliminada = !!e.eliminada;
      if (e.eliminado_por !== undefined) upd.eliminado_por = e.eliminado_por || '';
      if (e.fecha_eliminacion !== undefined) upd.fecha_eliminacion = e.fecha_eliminacion || '';
      if (e.creado_por) upd.creado_por = e.creado_por;
      if (e.observaciones_resp !== undefined) upd.observaciones_resp = e.observaciones_resp || '';
      if (e.observaciones_dir !== undefined) upd.observaciones_dir = e.observaciones_dir || '';
      if (e.observaciones_areas !== undefined) upd.observaciones_areas = (e.observaciones_areas && typeof e.observaciones_areas === 'object') ? e.observaciones_areas : {};
      if (e.checklist_json !== undefined) { try { upd.checklist = JSON.parse(e.checklist_json || '[]'); } catch (er) {} }
      var r = await sb.from('tareas').update(upd).eq('codigo', id);
      // Si la base aún no tiene la columna nueva, reintenta sin ella (no rompe
      // el guardado del checklist/estatus).
      if (r.error && /observaciones_areas/i.test(r.error.message || '')) {
        delete upd.observaciones_areas;
        r = await sb.from('tareas').update(upd).eq('codigo', id);
      }
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    // Guarda UNA acción del checklist de forma ATÓMICA (RPC tt_checklist_item):
    // la base mezcla el ítem con lo que ya haya, así una copia local vieja no
    // borra acciones agregadas por otra persona (pasaba en SPAC-006).
    // uid identifica al ítem; textoRef es su texto ANTES del cambio (respaldo
    // para ítems viejos sin uid). baseJson = checklist local completo, usado
    // SOLO si la fila aún no tiene checklist (tareas recién creadas/viejas).
    guardarItemChecklist: async function (token, id, uid, textoRef, item, borrar, baseJson) {
      var base = null;
      try { base = baseJson ? JSON.parse(baseJson) : null; } catch (e) { base = null; }
      var r = await sb.rpc('tt_checklist_item', {
        p_codigo: id, p_uid: uid || '', p_texto: textoRef || '',
        p_item: item || null, p_borrar: !!borrar, p_base: base
      });
      // Si la función aún no existe en la base (falta correr
      // supabase/checklist-item-rpc.sql), respaldo lee-mezcla-escribe: no es
      // atómico, pero mezcla contra lo RECIÉN leído (ventana de riesgo de ms,
      // no de minutos como antes).
      if (r.error && (r.error.code === 'PGRST202' || /find the function|schema cache/i.test(r.error.message || ''))) {
        try {
          var cur = await sb.from('tareas').select('checklist').eq('codigo', id).single();
          if (cur.error) return { ok: false, error: cur.error.message };
          var v = Array.isArray(cur.data && cur.data.checklist) ? cur.data.checklist : [];
          if (!v.length && Array.isArray(base)) v = base;
          var idx = -1;
          for (var i = 0; i < v.length; i++) {
            var e2 = v[i] || {};
            if ((uid && e2.uid === uid) || (textoRef && e2.texto === textoRef)) { idx = i; break; }
          }
          if (borrar) { if (idx >= 0) v.splice(idx, 1); }
          else if (item) { if (idx >= 0) v[idx] = item; else v.push(item); }
          // Marca el checklist como gestionado: un vacío ya NO se re-deriva del texto.
          var w = await sb.from('tareas').update({ checklist: v, checklist_iniciado: true }).eq('codigo', id);
          if (w.error) {
            // Si la columna aún no existe (falta correr el SQL), guarda al menos el checklist.
            if (/checklist_iniciado/i.test(w.error.message || '')) {
              w = await sb.from('tareas').update({ checklist: v }).eq('codigo', id);
            }
            if (w.error) return { ok: false, error: w.error.message };
          }
          return { ok: true, checklist: v };
        } catch (e3) { return { ok: false, error: String(e3) }; }
      }
      if (r.error) return { ok: false, error: r.error.message };
      if (r.data === null) return { ok: false, error: 'La tarea ya no existe.' };
      return { ok: true, checklist: Array.isArray(r.data) ? r.data : null };
    },
    // Guarda el ORDEN de las acciones (RPC tt_checklist_orden): la base
    // reacomoda sus ítems según la lista [{uid, texto}] recibida, con candado
    // de fila. Lo que no venga en la lista (una acción agregada por otra
    // persona al mismo tiempo) se conserva al final, no se pierde.
    reordenarChecklist: async function (token, id, orden, baseJson) {
      if (!Array.isArray(orden)) return { ok: false, error: 'Orden inválido.' };
      var base = null;
      try { base = baseJson ? JSON.parse(baseJson) : null; } catch (e) { base = null; }
      var r = await sb.rpc('tt_checklist_orden', { p_codigo: id, p_orden: orden, p_base: base });
      // Si la función aún no existe en la base (falta correr
      // supabase/checklist-orden-rpc.sql), respaldo lee-reordena-escribe con el
      // MISMO criterio (uid → texto; lo no listado queda al final).
      if (r.error && (r.error.code === 'PGRST202' || /find the function|schema cache/i.test(r.error.message || ''))) {
        try {
          var cur = await sb.from('tareas').select('checklist').eq('codigo', id).single();
          if (cur.error) return { ok: false, error: cur.error.message };
          var v = Array.isArray(cur.data && cur.data.checklist) ? cur.data.checklist : [];
          if (!v.length && Array.isArray(base)) v = base;
          var usado = v.map(function () { return false; });
          var out = [];
          orden.forEach(function (o) {
            var uid = (o && o.uid) || '', txt = (o && o.texto) || '', idx = -1, i;
            if (uid) { for (i = 0; i < v.length; i++) { if (!usado[i] && (v[i] || {}).uid === uid) { idx = i; break; } } }
            if (idx < 0 && txt) { for (i = 0; i < v.length; i++) { if (!usado[i] && (v[i] || {}).texto === txt) { idx = i; break; } } }
            if (idx >= 0) { out.push(v[idx]); usado[idx] = true; }
          });
          v.forEach(function (it, i2) { if (!usado[i2]) out.push(it); });
          var w = await sb.from('tareas').update({ checklist: out }).eq('codigo', id);
          if (w.error) return { ok: false, error: w.error.message };
          return { ok: true, checklist: out };
        } catch (e3) { return { ok: false, error: String(e3) }; }
      }
      if (r.error) return { ok: false, error: r.error.message };
      if (r.data === null) return { ok: false, error: 'La tarea ya no existe.' };
      return { ok: true, checklist: Array.isArray(r.data) ? r.data : null };
    },

    // ---- VOLANTES (registro de SGOI; tabla `volantes`, ver supabase/volantes.sql) ----
    obtenerVolantes: async function () {
      var r = await sb.from('volantes').select('*')
        .order('created_at', { ascending: false });
      if (r.error) return { ok: false, error: r.error.message, volantes: [] };
      return { ok: true, volantes: r.data || [] };
    },
    crearVolante: async function (token, d) {
      d = d || {};
      var fila = {
        numero: String(d.numero || '').toUpperCase().trim(),
        fecha_recepcion: fechaSql(d.fecha_recepcion),
        fecha_documento: fechaSql(d.fecha_documento),
        turnado_a: d.turnado_a || '', asignado_a: d.asignado_a || '',
        remitente: d.remitente || '',
        referencia: d.referencia || '', tipo_atencion: d.tipo_atencion || '',
        asunto: d.asunto || '', urgente: !!d.urgente,
        area: String(d.area || 'SGOI').toUpperCase(),
        creado_por: USUARIO_ACTUAL ? USUARIO_ACTUAL.nombre : ''
      };
      // Acciones y adjuntos capturados desde el formulario.
      if (Array.isArray(d.checklist)) fila.checklist = d.checklist;
      if (Array.isArray(d.adjuntos)) fila.adjuntos = d.adjuntos;
      var r = await sb.from('volantes').insert(fila).select('id').single();
      // Si a la base le falta alguna columna (no se ha re-corrido volantes.sql),
      // se quita SOLO esa, se AVISA (nunca pérdida silenciosa) y se reintenta,
      // las veces que haga falta si faltan varias.
      var aviso = '';
      var columnasOpc = ['asignado_a', 'urgente', 'area', 'checklist', 'adjuntos'];
      var intentos = 0;
      while (r.error && intentos++ < columnasOpc.length) {
        var msg = r.error.message || '';
        var col = columnasOpc.filter(function (c) {
          return (c in fila) && new RegExp('\\b' + c + '\\b', 'i').test(msg);
        })[0];
        if (!col) break;
        delete fila[col];
        aviso = (aviso ? aviso + ' ' : '') + 'El volante se guardó, pero "' + col + '" NO: falta esa columna en la base (correr supabase/volantes.sql).';
        r = await sb.from('volantes').insert(fila).select('id').single();
      }
      if (r.error) {
        if (esVolanteRepetido(r.error)) {
          var yaEsta = await volantePorNumero(fila.numero);
          return { ok: false, duplicado: yaEsta || { numero: fila.numero },
                   error: mensajeRepetido(fila.numero, yaEsta, false) };
        }
        return { ok: false, error: r.error.message };
      }
      return { ok: true, id: r.data.id, aviso: aviso || undefined };
    },
    actualizarVolante: async function (token, id, d) {
      d = d || {};
      var upd = {
        numero: String(d.numero || '').toUpperCase().trim(),
        fecha_recepcion: fechaSql(d.fecha_recepcion),
        fecha_documento: fechaSql(d.fecha_documento),
        turnado_a: d.turnado_a || '', asignado_a: d.asignado_a || '',
        remitente: d.remitente || '',
        referencia: d.referencia || '', tipo_atencion: d.tipo_atencion || '',
        asunto: d.asunto || '', urgente: !!d.urgente,
        area: String(d.area || 'SGOI').toUpperCase()
      };
      // Checklist/adjuntos solo se mandan si el formulario los MODIFICÓ (evita
      // pisar cambios de otra persona con una copia local vieja).
      if (Array.isArray(d.checklist)) upd.checklist = d.checklist;
      if (Array.isArray(d.adjuntos)) upd.adjuntos = d.adjuntos;
      var r = await sb.from('volantes').update(upd).eq('id', id);
      // Columna ausente en la base: se quita SOLO esa, se AVISA (nunca pérdida
      // silenciosa) y se reintenta, las veces que haga falta si faltan varias.
      var aviso2 = '';
      var columnasOpc2 = ['asignado_a', 'urgente', 'area', 'checklist', 'adjuntos'];
      var intentos2 = 0;
      while (r.error && intentos2++ < columnasOpc2.length) {
        var msg2 = r.error.message || '';
        var col2 = columnasOpc2.filter(function (c) {
          return (c in upd) && new RegExp('\\b' + c + '\\b', 'i').test(msg2);
        })[0];
        if (!col2) break;
        delete upd[col2];
        aviso2 = (aviso2 ? aviso2 + ' ' : '') + 'El volante se guardó, pero "' + col2 + '" NO: falta esa columna en la base (correr supabase/volantes.sql).';
        r = await sb.from('volantes').update(upd).eq('id', id);
      }
      if (r.error) {
        if (esVolanteRepetido(r.error)) {
          var yaEsta2 = await volantePorNumero(upd.numero, id);
          return { ok: false, duplicado: yaEsta2 || { numero: upd.numero },
                   error: mensajeRepetido(upd.numero, yaEsta2, true) };
        }
        return { ok: false, error: r.error.message };
      }
      return { ok: true, aviso: aviso2 || undefined };
    },
    eliminarVolante: async function (token, id) {
      // Purga primero su hilo/bitácora (viven en `bitacora` como 'VOL:<id>').
      try { await sb.from('bitacora').delete().eq('tarea_codigo', 'VOL:' + id); } catch (e) {}
      var r = await sb.from('volantes').delete().eq('id', id);
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    // Guarda SOLO la lista de adjuntos del volante (documento PDF, etc.).
    adjuntosVolante: async function (token, id, adjuntos) {
      var r = await sb.from('volantes').update({ adjuntos: Array.isArray(adjuntos) ? adjuntos : [] }).eq('id', id);
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    // Marca el volante como Atendido / lo reabre (En proceso).
    estatusVolante: async function (token, id, estatus) {
      var atendido = String(estatus || '') === 'Atendido';
      var upd = {
        estatus: atendido ? 'Atendido' : 'En proceso',
        atendido_por: atendido ? (USUARIO_ACTUAL ? USUARIO_ACTUAL.nombre : '') : '',
        fecha_atendido: atendido ? new Date().toISOString() : null
      };
      var r = await sb.from('volantes').update(upd).eq('id', id);
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    // Guarda UNA acción del checklist del volante (agregar/editar/palomear/quitar).
    // Lee-mezcla-escribe contra lo RECIÉN leído: una copia local vieja no pisa
    // acciones agregadas por otra persona (misma lección que SPAC-006; aquí sin
    // RPC porque el volumen es bajo y la ventana de riesgo es de milisegundos).
    volanteChecklistItem: async function (token, id, uid, item, borrar) {
      var cur = await sb.from('volantes').select('checklist').eq('id', id).single();
      if (cur.error) return { ok: false, error: cur.error.message };
      var v = Array.isArray(cur.data && cur.data.checklist) ? cur.data.checklist : [];
      var idx = -1;
      for (var i = 0; i < v.length; i++) { if ((v[i] || {}).uid === uid) { idx = i; break; } }
      if (borrar) { if (idx >= 0) v.splice(idx, 1); }
      else if (item) { if (idx >= 0) v[idx] = item; else v.push(item); }
      var w = await sb.from('volantes').update({ checklist: v }).eq('id', id);
      if (w.error) return { ok: false, error: w.error.message };
      return { ok: true, checklist: v };
    },
    // Hilo + bitácora de UN volante (filas 'VOL:<id>' de la tabla bitacora).
    obtenerBitacoraVolante: async function (id) {
      var r = await sb.from('bitacora').select('*')
        .eq('tarea_codigo', 'VOL:' + id)
        .order('fecha', { ascending: false });
      if (r.error) return { ok: false, error: r.error.message, bitacora: [] };
      return { ok: true, bitacora: (r.data || []).map(function (b) {
        return { id: b.id, fecha: fmtFecha(b.fecha), usuario: b.usuario || '', accion: b.accion || '',
          estatus_anterior: b.estatus_anterior || '', estatus_nuevo: b.estatus_nuevo || '', comentario: b.comentario || '' };
      }) };
    },
    // Borra UNA entrada de bitácora por id (el front lo limita a comentarios propios).
    borrarEntradaBitacora: async function (token, id) {
      var r = await sb.from('bitacora').delete().eq('id', id);
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },

    // ---- BITÁCORA ----
    obtenerBitacora: async function () {
      // PostgREST regresa máx. 1000 filas por petición: se pagina para traer TODA
      // la bitácora. Si no, al pasar de 1000 movimientos las entradas viejas
      // ("crear", comentarios, vistos, reprogramaciones) desaparecen de la app
      // — así se perdió el "Creada por" del historial de JDGA-001.
      var PAG = 1000, filas = [], desde = 0;
      while (true) {
        var r = await sb.from('bitacora').select('*')
          .not('tarea_codigo', 'like', 'VOL:%')   // el hilo/bitácora de VOLANTES no va en la bitácora de tareas
          .order('fecha', { ascending: false })
          .range(desde, desde + PAG - 1);
        if (r.error) break;                        // lo ya traído se usa igual
        filas = filas.concat(r.data || []);
        if (!r.data || r.data.length < PAG) break; // página incompleta = no hay más
        desde += PAG;
      }
      return { ok: true, bitacora: filas.map(function (b) {
        // fecha = ya formateada para mostrar; fecha_iso = la cruda, que es la
        // que sirve para comparar y ordenar (la campanita necesita saber qué
        // llegó después de la última vez que abriste las notificaciones).
        return { id: b.id, fecha: fmtFecha(b.fecha), fecha_iso: b.fecha || '',
          usuario: b.usuario || '', accion: b.accion || '',
          id_tarea: b.tarea_codigo || '', estatus_anterior: b.estatus_anterior || '',
          estatus_nuevo: b.estatus_nuevo || '', comentario: b.comentario || '' };
      }) };
    },
    // Cambia la acción de una entrada de bitácora por su id (para correcciones).
    editarAccionBitacora: async function (token, id, accion) {
      var r = await sb.from('bitacora').update({ accion: accion }).eq('id', id);
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },
    registrarBitacora: async function (token, ent) {
      ent = ent || {};
      try {
        await sb.from('bitacora').insert({ tarea_codigo: ent.id_tarea || '', usuario: ent.usuario || '',
          accion: ent.accion || '', estatus_anterior: ent.estatus_anterior || '', estatus_nuevo: ent.estatus_nuevo || '',
          comentario: ent.comentario || '' });
      } catch (e) {}
      return { ok: true };
    },

    // ---- ÁREAS ----
    obtenerAreas: async function () {
      var todas = AREAS_BASE.slice();
      try {
        var r = await sb.from('areas_catalogo').select('nombre');
        if (!r.error && r.data) r.data.forEach(function (a) { if (todas.indexOf(a.nombre) < 0) todas.push(a.nombre); });
      } catch (e) {}
      return { ok: true, areas: todas };
    },

    // ---- ADJUNTOS (Google Drive vía mini Apps Script) ----
    subirArchivo: async function (token, nombre, mime, base64, destino) {
      try {
        var resp = await fetch(DRIVE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'subir', nombre: nombre, mime: mime, base64: base64, destino: destino || '' }) });
        return await resp.json();
      } catch (e) { return { ok: false, error: String(e) }; }
    },
    borrarArchivoDrive: async function (token, url) {
      try {
        var resp = await fetch(DRIVE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'borrar', url: url }) });
        return await resp.json();
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    // ---- CORREO (aviso al crear tarea, vía el MISMO mini Apps Script de Drive) ----
    // El remitente real es la cuenta del Apps Script; deNombre/replyTo hacen que
    // el correo aparezca a nombre del usuario que creó la tarea (y las respuestas
    // le llegan a él). NO requiere contraseñas de los demás usuarios.
    enviarCorreo: async function (datos) {
      datos = datos || {};
      try {
        var resp = await fetch(CORREO_URL || DRIVE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'correo',
            para: datos.para || '', asunto: datos.asunto || '', cuerpo: datos.cuerpo || '',
            deNombre: datos.deNombre || '', replyTo: datos.replyTo || '', cc: datos.cc || '' }) });
        return await resp.json();
      } catch (e) { return { ok: false, error: String(e) }; }
    },
    // Resuelve el/los correo(s) de personas por su NOMBRE (para autollenar "Para").
    correoDe: async function (nombres) {
      try {
        var arr = Array.isArray(nombres) ? nombres : [nombres];
        var r = await sb.rpc('correos_de_personas', { p_nombres: arr });
        if (r.error || !r.data) return { ok: true, correos: [] };
        return { ok: true, correos: r.data.map(function (x) { return x.email; }).filter(Boolean) };
      } catch (e) { return { ok: false, error: String(e), correos: [] }; }
    },

    // ---- PLANTILLA DEL CORREO (asunto + cuerpo con variables {{...}}) ----
    // La LEE cualquier usuario autenticado (la app la usa para prellenar el
    // aviso al crear una tarea). Solo el DIRECTOR la puede GUARDAR (lo impone
    // la RLS de la tabla plantilla_correo; aquí se detecta si no hubo permiso).
    leerPlantillaCorreo: async function () {
      try {
        var r = await sb.from('plantilla_correo').select('asunto,cuerpo,activo').eq('id', 1).single();
        if (r.error || !r.data) return { ok: false, error: r.error ? r.error.message : 'sin plantilla' };
        return { ok: true, asunto: r.data.asunto || '', cuerpo: r.data.cuerpo || '', activo: r.data.activo !== false };
      } catch (e) { return { ok: false, error: String(e) }; }
    },
    guardarPlantillaCorreo: async function (datos) {
      datos = datos || {};
      try {
        var upd = {
          asunto: String(datos.asunto || ''),
          cuerpo: String(datos.cuerpo || ''),
          activo: datos.activo !== false,
          updated_at: new Date().toISOString()
        };
        var r = await sb.from('plantilla_correo').update(upd).eq('id', 1).select('id');
        if (r.error) return { ok: false, error: r.error.message };
        // La RLS deja a los no-Director actualizar 0 filas (sin error): lo detectamos.
        if (!r.data || !r.data.length) return { ok: false, error: 'Solo el Director puede editar la plantilla.' };
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    // ---- JUEGO "Reta a la Ley": avance de estudio del usuario ----
    // El juego funciona con localStorage (offline); esto es el respaldo en la
    // cuenta para que el avance siga al usuario a cualquier dispositivo. Si la
    // tabla todavía no existe (falta correr supabase/juego.sql), regresa
    // ok:false y el juego sigue jugándose solo con el navegador.
    leerProgresoJuego: async function () {
      try {
        var u = await sb.auth.getUser();
        var uid = u.data && u.data.user && u.data.user.id;
        if (!uid) return { ok: false, error: 'sin sesión', progreso: {} };
        var r = await sb.from('juego_progreso').select('ley,datos').eq('usuario_id', uid);
        if (r.error) return { ok: false, error: r.error.message, progreso: {} };
        var out = {};
        (r.data || []).forEach(function (x) { out[x.ley] = x.datos || {}; });
        return { ok: true, progreso: out };
      } catch (e) { return { ok: false, error: String(e), progreso: {} }; }
    },
    guardarProgresoJuego: async function (ley, datos) {
      try {
        var u = await sb.auth.getUser();
        var uid = u.data && u.data.user && u.data.user.id;
        if (!uid) return { ok: false, error: 'sin sesión' };
        var r = await sb.from('juego_progreso').upsert({
          usuario_id: uid,
          ley: String(ley || ''),
          datos: datos || {},
          actualizado: new Date().toISOString()
        }, { onConflict: 'usuario_id,ley' });
        if (r.error) return { ok: false, error: r.error.message };
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    // ---- no-ops (existían en Apps Script, aquí no aplican) ----
    // Cambiar la contraseña del usuario logueado.
    cambiarContrasena: async function (token, nueva) {
      nueva = String(nueva || '');
      if (nueva.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
      var r = await sb.auth.updateUser({ password: nueva });
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    },

    vaciarCacheHtml: async function () { return { ok: true }; }
  };

  // ====================== SHIM de google.script.run ======================
  // Cada acceso a google.script.run devuelve un "runner" nuevo, encadenable con
  // withSuccessHandler / withFailureHandler, igual que en Apps Script.
  function nuevoRunner() {
    var onOk = function () {}, onErr = function (e) { console.error('TT backend error:', e); };
    var api = {
      withSuccessHandler: function (fn) { if (fn) onOk = fn; return api; },
      withFailureHandler: function (fn) { if (fn) onErr = fn; return api; },
      withUserObject: function () { return api; }
    };
    Object.keys(BACKEND).forEach(function (name) {
      api[name] = function () {
        var args = Array.prototype.slice.call(arguments);
        Promise.resolve()
          // 1) Renueva el token si está por vencer (evita que el guardado llegue
          //    a la base como "anónimo" por un token vencido).
          .then(function () { return asegurarSesion(); })
          .then(function () { return BACKEND[name].apply(null, args); })
          // 2) Si aun así falló por sesión muerta, avisa claro y regresa al login,
          //    en vez de mostrar el error técnico de RLS.
          .then(async function (res) {
            if (res && res.ok === false && textoDeSesionMuerta(res.error) && !(await sesionViva())) {
              dispararSesionVencida();
              res = { ok: false, sesionVencida: true, error: 'Tu sesión venció. Vuelve a entrar.' };
            }
            onOk(res);
          })
          .catch(function (err) { onErr(err && err.message ? err : new Error(String(err))); });
        return api;
      };
    });
    return api;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', { configurable: true, get: nuevoRunner });
  // host (para que google.script.host.* no truene si se llama)
  window.google.script.host = window.google.script.host || { close: function () {}, setHeight: function () {}, setWidth: function () {} };

  console.log('TT · puente Supabase listo (', SUPABASE_URL, ')');
})();
