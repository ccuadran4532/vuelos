// Service worker: permite instalar la app y abrirla sin internet con los últimos datos.
const CACHE = "vuelos-v18";
const ARCHIVOS = ["./", "./index.html", "./styles.css", "./app.js", "./config.js", "./manifest.webmanifest", "./buscar.js", "./asistente.js", "./aeropuertos.json",
  "./icons/asientos-192.png", "./icons/asientos-512.png", "./icons/asientos-favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  // El cerebro (script.google.com) siempre va a la red; los datos se guardan en el teléfono desde app.js.
  if (e.request.url.includes("script.google")) return;
  if (e.request.method !== "GET") return;
  // Red primero: siempre la última versión de la app; el caché es respaldo sin internet.
  e.respondWith(
    // no-cache: siempre pregunta al servidor si hay una versión nueva (GitHub deja guardar 10 min).
    fetch(new Request(e.request, { cache: "no-cache" })).then((resp) => {
      const copia = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
