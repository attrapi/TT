/* ==========================================================================
   Service Worker — Plataforma TT
   --------------------------------------------------------------------------
   Da a la app:
     • Apertura instantánea (el "cascarón" se sirve desde caché).
     • Funcionamiento sin conexión (si te quedas sin datos, la app abre igual).
     • Base para notificaciones push más adelante.

   REGLAS IMPORTANTES (para NO servir datos viejos):
     • La navegación (index.html) usa "network-first": si hay internet SIEMPRE
       baja la última versión; solo cae a la copia en caché cuando no hay red.
     • Supabase, Apps Script y los CSV de Google Sheets NUNCA se cachean:
       son datos vivos y con sesión; siempre van directo a la red.
     • Estáticos (fuentes, íconos, shim, leyes) usan "stale-while-revalidate":
       responden al instante desde caché y se actualizan en segundo plano.

   Al cambiar algo del cascarón, sube el número de versión (CACHE_VERSION) para
   que el navegador limpie la caché vieja y tome la nueva.
   ========================================================================== */

const CACHE_VERSION = 'tt-v1-20260803d';
const CACHE_NAME = 'tt-cache-' + CACHE_VERSION;

// Cascarón mínimo que se precachea al instalar. Rutas relativas para que
// funcione igual en la raíz o en un subpath de GitHub Pages.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

// Dominios de datos VIVOS: nunca se cachean, siempre red directa.
const RED_DIRECTA = [
  'supabase.co',
  'supabase.in',
  'script.google.com',
  'script.googleusercontent.com',
  'docs.google.com',
  'drive.google.com',
  'spreadsheets.google.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})          // que una falla de precache no rompa la instalación
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((c) => c.startsWith('tt-cache-') && c !== CACHE_NAME)
              .map((c) => caches.delete(c))
      ))
      .then(() => self.clients.claim())
  );
});

// ¿La petición es a un dominio de datos vivos?
function esRedDirecta(url) {
  return RED_DIRECTA.some((d) => url.hostname === d || url.hostname.endsWith('.' + d));
}

// Guarda en caché solo respuestas válidas (evita cachear errores).
function guardarEnCache(request, response) {
  if (!response || response.status !== 200 || response.type === 'error') return response;
  const copia = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copia)).catch(() => {});
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo GET; lo demás (POST a Supabase, etc.) va directo a la red.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Datos vivos (Supabase / Apps Script / Sheets): nunca caché.
  if (esRedDirecta(url)) return;

  // Navegación (abrir/recargar la app): network-first para tomar siempre la
  // última versión cuando hay internet; caché como respaldo sin conexión.
  // OJO con `cache: 'reload'`: GitHub Pages sirve el HTML con max-age=600, así
  // que un fetch normal se resuelve contra la caché HTTP del navegador y nos
  // devolvía el index.html de hasta 10 minutos atrás — "network-first" solo de
  // nombre. Con 'reload' se ignora esa caché (y de paso se actualiza), que es
  // lo que hace que un cambio recién publicado se vea al recargar.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req.url, { cache: 'reload', credentials: 'same-origin' })
        .then((res) => guardarEnCache(req, res))
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Resto de estáticos (fuentes, CDN, shim, leyes, íconos):
  // stale-while-revalidate — responde de caché al instante y refresca detrás.
  event.respondWith(
    caches.match(req).then((cacheada) => {
      const red = fetch(req)
        .then((res) => guardarEnCache(req, res))
        .catch(() => cacheada);        // sin red: usa lo cacheado si existe
      return cacheada || red;
    })
  );
});

// Base para notificaciones push (a futuro): al recibir un push se muestra una
// notificación; al tocarla se enfoca/abre la app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ('focus' in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
