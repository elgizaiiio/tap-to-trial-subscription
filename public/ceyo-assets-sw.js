/* Public immutable assets only. Never cache navigations, API responses or private data. */
const CACHE = "ceyo-public-assets-v1";
const LIMIT = 160;
function cacheable(request) {
  const url = new URL(request.url);
  return request.method === "GET" && url.origin === self.location.origin &&
    !url.search && /^\/assets\/[\w./-]+-[\w-]{8,}\.(js|css|woff2?|png|jpe?g|webp|avif|svg)$/.test(url.pathname);
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith("ceyo-public-assets-") && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  if (!cacheable(event.request)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request);
    if (hit) return hit;
    const response = await fetch(event.request);
    // The deployment, not a URL alone, must explicitly mark a response public/immutable.
    const policy = response.headers.get("cache-control") || "";
    if (response.ok && response.type === "basic" && /\bpublic\b/i.test(policy) && /\bimmutable\b/i.test(policy) && !/\b(private|no-store)\b/i.test(policy)) {
      await cache.put(event.request, response.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - LIMIT)).map(key => cache.delete(key)));
    }
    return response;
  })());
});