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

  // ---- Configuración (la anon/publishable key es pública: va en el navegador) ----
  var SUPABASE_URL = 'https://cduqgcyktcruvxrmlkks.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_6Qhw_ZADne61Yg5-WtpMBA_XqAxnzvI';
  var DOMINIO      = '@attrapi.gob.mx';     // se agrega al usuario corto para el login
  // Mini Apps Script (solo adjuntos a Drive). Se conecta en el siguiente paso.
  var DRIVE_URL    = 'https://script.google.com/macros/s/AKfycbyZgAmAerXuSXlI3l_WAre1rLfSFt3Omt1C_48S2DUH24ySkRW0L5lIJrTVyaH-OXI6xw/exec';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var USUARIO_ACTUAL = null;   // perfil del usuario logueado (para creado_por, etc.)

  // --- Tiempo real: cuando cambian las tareas en la base, refrescar en pantalla ---
  var canalRT = null;
  function suscribirRealtime() {
    if (canalRT) return;   // ya suscrito
    try {
      canalRT = sb.channel('tt-tareas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, function () {
          if (typeof window.ttRefrescar === 'function') window.ttRefrescar();
        })
        .subscribe();
    } catch (e) { /* si realtime no está habilitado, la app sigue normal */ }
  }

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
      nombre_corto: p ? (p.nombre_corto || '') : ''
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
      observaciones_resp: r.observaciones_resp || '', observaciones_dir: r.observaciones_dir || '',
      observaciones_areas: (r.observaciones_areas && typeof r.observaciones_areas === 'object') ? r.observaciones_areas : {},
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
      suscribirRealtime();
      return { ok: true, token: session.access_token, usuario: USUARIO_ACTUAL };
    },
    cerrarSesion: async function () { try { await sb.auth.signOut(); } catch (e) {} return { ok: true }; },

    listarUsuarios: async function () {
      var r = await sb.from('perfiles').select('nombre, rol, subdireccion').eq('activo', true);
      if (r.error || !r.data) return { ok: false, usuarios: [] };
      return { ok: true, usuarios: r.data.map(function (p) {
        return { usuario: '', nombre: p.nombre || '', rol: (p.rol === 'Director') ? 'Director' : 'Capturista', subdireccion: String(p.subdireccion || '').toUpperCase() };
      }) };
    },
    listarResponsables: async function () {
      var r = await sb.from('perfiles').select('nombre, rol, subdireccion, jefatura, es_enlace, nombre_corto').eq('activo', true);
      if (r.error || !r.data) return { ok: true, responsables: [] };
      var out = r.data.filter(function (p) { return p.rol !== 'Director' && (p.nombre || '').trim(); })
        .map(function (p) { return { nombreCompleto: p.nombre.trim(), subdireccion: String(p.subdireccion || '').toUpperCase(), jefatura: p.jefatura || '', es_enlace: !!p.es_enlace, nombre_corto: p.nombre_corto || '' }; });
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
      var r = await sb.from('tareas').insert(fila).select('codigo').single();
      // Si la base aún no tiene esas columnas, reintenta sin ellas (no rompe).
      if (r.error && /adjuntos|participantes/i.test(r.error.message || '')) {
        delete fila.adjuntos; delete fila.participantes;
        r = await sb.from('tareas').insert(fila).select('codigo').single();
      }
      if (r.error) return { ok: false, error: r.error.message };
      try { await sb.from('bitacora').insert({ tarea_codigo: r.data.codigo, usuario: fila.creado_por, accion: 'crear', estatus_anterior: '—', estatus_nuevo: 'En Proceso' }); } catch (e) {}
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
      var r = await sb.from('tareas').update(upd).eq('codigo', id);
      // Si la base aún no tiene esas columnas, reintenta sin ellas (no rompe).
      if (r.error && /adjuntos|participantes/i.test(r.error.message || '')) {
        delete upd.adjuntos; delete upd.participantes;
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

    // ---- BITÁCORA ----
    obtenerBitacora: async function () {
      var r = await sb.from('bitacora').select('*').order('fecha', { ascending: false });
      if (r.error) return { ok: true, bitacora: [] };
      return { ok: true, bitacora: (r.data || []).map(function (b) {
        return { id: b.id, fecha: fmtFecha(b.fecha), usuario: b.usuario || '', accion: b.accion || '',
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
        Promise.resolve().then(function () { return BACKEND[name].apply(null, args); })
          .then(function (res) { onOk(res); })
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
