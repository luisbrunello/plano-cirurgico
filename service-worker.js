const CACHE_NAME = "plano-cirurgico-v68";
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

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const freshReq = new Request(req, {cache:"no-store"});
    const response = await fetch(freshReq);
    if (response && response.ok) await cache.put(req, response.clone());
    return response;
  } catch (e) {
    return (await cache.match(req)) || (req.mode === "navigate" ? await cache.match("./index.html") : Response.error());
  }
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  const isHtml2Canvas =
    (url.hostname === "cdn.jsdelivr.net" || url.hostname === "cdnjs.cloudflare.com") &&
    url.pathname.toLowerCase().includes("html2canvas");

  if (isHtml2Canvas) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        try {
          const response = await fetch(req);
          if (response && response.ok) await cache.put(req, response.clone());
          return response;
        } catch (e) {
          return (await cache.match(req)) || Response.error();
        }
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  }
});
