// DECODE Service Worker
// Handles: offline caching, push notifications, background sync
// Built with Workbox-style caching strategies (manual implementation)

const CACHE_NAME    = 'decode-v1'
const STATIC_ASSETS = ['/', '/index.html']

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network-first for API, cache-first for assets ─────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // API calls: always network, never cache
  if (url.pathname.startsWith('/api/')) return

  // Navigation requests: serve index.html from cache if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html')
      )
    )
    return
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let data = { title: 'DECODE', body: 'Time to check in', url: '/' }
  try { data = event.data.json() } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icon-192.png',
      badge:   '/icon-72.png',
      tag:     'decode-nudge',          // replaces old notification of same type
      renotify:true,
      data:    { url: data.url },
      actions: [
        { action: 'open', title: 'Open DECODE' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const url = event.notification.data?.url || '/'
      const existing = clientList.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); return }
      return clients.openWindow(url)
    })
  )
})

// ── Background sync (queue failed saves) ─────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-logs') {
    event.waitUntil(syncQueuedLogs())
  }
})

async function syncQueuedLogs() {
  // Read queued logs from IndexedDB and replay them
  // This fires automatically when connection is restored
  try {
    const db    = await openDB()
    const queue = await getAllFromStore(db, 'queue')
    for (const item of queue) {
      try {
        const res = await fetch('/api/log', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-app-token': item.token || '' },
          body:    JSON.stringify(item.payload),
        })
        if (res.ok) await deleteFromStore(db, 'queue', item.id)
      } catch { /* still offline, leave in queue */ }
    }
  } catch (err) {
    console.warn('[SW] Background sync failed:', err)
  }
}

// ── Minimal IndexedDB helpers ─────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('decode-offline', 1)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = () => reject(req.error)
  })
}
function getAllFromStore(db, store) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
function deleteFromStore(db, store, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}