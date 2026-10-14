/* Offline support: everything the app needs is cached on first visit. */
const CACHE = "te-invoices-v1";
const FILES = [
  "./", "index.html", "app.css", "invoice.css", "invoice.js", "app.js", "manifest.webmanifest",
  "assets/logo.png",
  "vendor/html2canvas.min.js", "vendor/jspdf.umd.min.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png",
  "fonts/montserrat-latin-400-normal.woff2", "fonts/montserrat-latin-500-normal.woff2", "fonts/montserrat-latin-600-normal.woff2",
  "fonts/montserrat-latin-700-normal.woff2", "fonts/montserrat-latin-800-normal.woff2",
  "fonts/barlow-semi-condensed-latin-500-normal.woff2", "fonts/barlow-semi-condensed-latin-600-normal.woff2",
  "fonts/barlow-semi-condensed-latin-700-normal.woff2", "fonts/barlow-semi-condensed-latin-800-normal.woff2",
  "fonts/kaushan-script-latin-400-normal.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // pages: network first so updates arrive, cache as the offline fallback
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; }))
  );
});
