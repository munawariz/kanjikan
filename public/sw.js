/* Kanjikan service worker.
 *
 * Deliberately conservative about what it stores.
 *
 * This app is multi-user and its pages are rendered per account. Caching an
 * authenticated HTML response would leave one learner's dashboard on disk for
 * whoever opens the browser next, so navigations are never cached — they go to
 * the network, and fall back to a generic offline page if that fails. Only
 * content that is identical for everybody is cached: hashed build assets,
 * icons, and the webfonts.
 *
 * The API is never cached either. A stale answer from /api/answer would look
 * like progress that saved when it did not.
 */

const VERSION = "v1";
const STATIC_CACHE = `kanjikan-static-${VERSION}`;
const FONT_CACHE = `kanjikan-fonts-${VERSION}`;
/* A standalone HTML file, not a Next route: this is served in place of a
 * different URL, and a framework page would try to hydrate an RSC payload for
 * the wrong route and fail with a client-side exception instead of rendering
 * the message. */
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("kanjikan-") && !k.endsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Hashed build output and icons: immutable, so serve from cache when present. */
function isImmutable(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg"
  );
}

function isFont(url) {
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch the API, or anything that is not plain http(s).
  if (url.pathname.startsWith("/api/") || !url.protocol.startsWith("http")) return;

  // Navigations: network only. See the note at the top of this file — these
  // responses are per-account and must not be written to disk.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  if (isImmutable(url) && url.origin === self.location.origin) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  if (isFont(url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        // Serve the cached face immediately and refresh it in the background.
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit ?? network;
      }),
    );
  }
});
