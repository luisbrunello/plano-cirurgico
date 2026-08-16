const CACHE_NAME = "plano-cirurgico-v54";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./robots.txt",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isHtml2Canvas =
    (url.hostname === "cdn.jsdelivr.net" || url.hostname === "cdnjs.cloudflare.com") &&
    url.pathname.toLowerCase().includes("html2canvas");

  // Depois do primeiro carregamento online, mantém html2canvas disponível no cache.
  if (isHtml2Canvas) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
          return response;
        });
      })
    );
    return;
  }

  // Navegação: tenta rede primeiro para receber atualizações; cai no app em cache se offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Arquivos do próprio app: cache primeiro.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return response;
      }))
    );
  }
});
