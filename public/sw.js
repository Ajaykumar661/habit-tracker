/* Tally Wall service worker.
 *
 * The app is local-first: the record lives in localStorage and never leaves
 * the device. This worker extends that to the code itself, so opening the
 * app on a plane works exactly like opening it at home.
 *
 * Two strategies, chosen by what the request is:
 *
 *   - the HTML document: network first, cache as fallback. A shell served
 *     from cache forever would pin people to an old build.
 *   - everything else (hashed JS/CSS, art, fonts, audio): cache first. The
 *     filenames carry a content hash, so a cached one can never be stale;
 *     a new build simply asks for new names.
 *
 * Nothing here caches anything cross-origin, and nothing is ever sent
 * anywhere. There is no server to send it to.
 */

const VERSION = 'v1';
const SHELL = `tally-wall-shell-${VERSION}`;
const RUNTIME = `tally-wall-runtime-${VERSION}`;

// Only what is needed to render something on a cold, offline start. The
// hashed bundles arrive through the runtime cache on first visit.
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // One missing file must not fail the whole install.
    await Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, RUNTIME]);
    const names = await caches.keys();
    await Promise.all(names.map((n) => (keep.has(n) ? null : caches.delete(n))));
    await self.clients.claim();
  })());
});

const isDocument = (request) =>
  request.mode === 'navigate' || request.destination === 'document';

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch anything but plain same-origin reads.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isDocument(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch {
        // Offline: any entry point should still open the app.
        return (await caches.match('/index.html'))
          || (await caches.match('/'))
          || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(request);
    if (hit) return hit;
    try {
      const fresh = await fetch(request);
      // Opaque and error responses are not worth keeping.
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(RUNTIME);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});
