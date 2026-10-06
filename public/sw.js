/* Scorecade service worker — offline app shell + Steam CDN image cache.
 *
 * Strategy (dev-safe):
 *  - navigations: network-first, fallback to the cached shell ("/")
 *  - /_next/static + site icons: network-first with cache backup (fresh dev JS wins)
 *  - Steam CDN images (covers/headers/screenshots): cache-first, trimmed to 300
 *  - /api/**: never intercepted (auth/user data must always hit the network)
 */
const VERSION = "v1";
const SHELL_CACHE = `scorecade-shell-${VERSION}`;
const IMAGE_CACHE = "scorecade-images";
const MAX_IMAGES = 300;
const MAX_SHELL = 80;

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
  "/logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      const cache = await caches.open(SHELL_CACHE);
      // Precache individually — one failed fetch must not block installation.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (n) => n.startsWith("scorecade-shell-") && n !== SHELL_CACHE,
          )
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // API and cross-origin non-image traffic: never intercepted.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  // Steam CDN images: cache-first.
  if (/\.steamstatic\.com$/.test(url.hostname)) {
    event.respondWith(cacheFirstImage(req));
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/icon-maskable.svg" ||
    url.pathname === "/logo.svg" ||
    url.pathname === "/manifest.webmanifest";

  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
  } else if (isStaticAsset) {
    event.respondWith(networkFirstAsset(req));
  }
  // Everything else: plain network.
});

async function cacheFirstImage(req) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // opaque (cors) responses have status 0 — still displayable, keep them.
    if (res.status === 200 || res.type === "opaque") {
      await cache.put(req, res.clone());
      trimCache(IMAGE_CACHE, MAX_IMAGES);
    }
    return res;
  } catch (err) {
    const retry = await cache.match(req);
    if (retry) return retry;
    throw err;
  }
}

async function networkFirstNavigation(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) {
      // All in-app navigations are the same SPA shell — store under "/".
      await cache.put("/", res.clone());
    }
    return res;
  } catch {
    const shell =
      (await cache.match("/")) ||
      (await cache.match(req, { ignoreSearch: true }));
    if (shell) return shell;
    return new Response("Офлайн", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function networkFirstAsset(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(req, res.clone());
      trimCache(SHELL_CACHE, MAX_SHELL);
    }
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error("offline");
  }
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}
