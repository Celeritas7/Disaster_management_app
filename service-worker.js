// CacheStorage is shared by every app on the same origin (including other
// Celeritas7 GitHub Pages projects). Never delete or read another app's caches.
// Bump the revision whenever a shipped shell asset changes.
const CACHE = 'disaster-management-app-v6';
const OWNED_CACHE = /^disaster-management-app-v\d+$/;
const SHELL = ['./', './index.html', './styles.css', './phase1b.css', './phase1c.css', './app.js', './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
const scope = new URL(self.registration.scope);
const shellUrls = new Set(SHELL.map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  // Reload avoids installing an old HTTP-cached copy of a newly released file.
  const requests = [...shellUrls].map(url => new Request(url, {cache:'reload'}));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => OWNED_CACHE.test(key) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // A worker controls clients in its scope, but those clients may request
  // resources elsewhere on the origin. Only cache this project's shell.
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const key = url.origin + url.pathname;
  if (!shellUrls.has(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request, {ignoreSearch:true});
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) event.waitUntil(cache.put(request, response.clone()));
    return response;
  }));
});
