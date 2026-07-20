const SHELL_CACHE = "command-center-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.headers.has("authorization")) return;
  if (
    ["/auth", "/projects", "/jobs"].some(
      (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
    )
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => (response.ok ? response : Promise.reject()))
        .catch(() => caches.match("/")),
    );
    return;
  }
  if (
    url.origin !== self.location.origin ||
    !["style", "script", "image", "font", "manifest"].includes(request.destination)
  )
    return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic")
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        }),
    ),
  );
});
