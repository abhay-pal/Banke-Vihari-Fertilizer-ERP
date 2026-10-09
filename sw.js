const CACHE = 'banke-vihari-shell-v1'
const SHELL = ['/', '/manifest.webmanifest']
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/functions/')) return
  event.respondWith(fetch(request).then(response => {
    if (response.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'document' || request.destination === 'font')) {
      const copy = response.clone()
      caches.open(CACHE).then(cache => cache.put(request, copy))
    }
    return response
  }).catch(async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') return caches.match('/')
    return Response.error()
  }))
})
