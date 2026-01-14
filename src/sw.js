/**
 * Service Worker per Scripta Manent
 * Gestisce caching e funzionamento offline
 */

const CACHE_NAME = 'scripta-manent-v1';
const STATIC_CACHE = 'scripta-manent-static-v1';
const DYNAMIC_CACHE = 'scripta-manent-dynamic-v1';

// File da cachare immediatamente all'installazione
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/style.css',
    '/js/app.js',
    '/js/config.js',
    '/js/storage/storage-interface.js',
    '/js/storage/google-drive.js',
    '/js/crypto/encryption.js',
    '/js/crypto/key-manager.js',
    '/js/models/note.js',
    '/js/models/file-item.js',
    '/js/models/folder.js',
    '/js/services/notes-service.js',
    '/js/services/files-service.js',
    '/js/services/search-service.js',
    '/js/services/trash-service.js',
    '/js/services/share-service.js',
    '/js/ui/router.js',
    '/js/ui/components/modal.js',
    '/js/ui/components/toast.js',
    '/js/ui/components/editor.js',
    '/js/ui/components/file-list.js',
    '/js/ui/components/media-gallery.js',
    '/js/ui/views/home-view.js',
    '/js/ui/views/notes-view.js',
    '/js/ui/views/files-view.js',
    '/js/ui/views/media-view.js',
    '/js/ui/views/trash-view.js',
    '/js/ui/views/settings-view.js',
    '/js/ui/views/note-editor-view.js',
    '/js/utils/hash.js',
    '/js/utils/qrcode.js',
    '/js/utils/markdown.js',
    '/assets/icons/icon.svg',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// URL da non cachare mai (API Google)
const NEVER_CACHE = [
    'googleapis.com',
    'accounts.google.com',
    'gstatic.com'
];

/**
 * Evento di installazione
 * Cacha tutti gli asset statici
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installazione in corso...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Cache degli asset statici');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Forza l'attivazione immediata senza aspettare
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Errore durante installazione:', error);
            })
    );
});

/**
 * Evento di attivazione
 * Pulisce le cache vecchie
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Attivazione in corso...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            // Elimina cache con versioni diverse
                            return cacheName.startsWith('scripta-manent-') &&
                                   cacheName !== STATIC_CACHE &&
                                   cacheName !== DYNAMIC_CACHE;
                        })
                        .map((cacheName) => {
                            console.log('[SW] Eliminazione cache vecchia:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                // Prendi controllo di tutte le pagine aperte
                return self.clients.claim();
            })
    );
});

/**
 * Strategia di caching per le richieste
 */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Non cachare richieste a Google API
    if (NEVER_CACHE.some(domain => url.hostname.includes(domain))) {
        return;
    }

    // Non cachare richieste POST
    if (event.request.method !== 'GET') {
        return;
    }

    // Strategia Cache-First per asset statici
    if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // Strategia Network-First per tutto il resto (contenuti dinamici)
    event.respondWith(networkFirst(event.request));
});

/**
 * Strategia Cache-First
 * Cerca prima in cache, poi in rete
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Se offline, ritorna pagina di fallback
        return caches.match('/index.html');
    }
}

/**
 * Strategia Network-First
 * Prova prima la rete, poi la cache
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }

        // Se è una navigazione, ritorna index.html per il router client-side
        if (request.mode === 'navigate') {
            return caches.match('/index.html');
        }

        throw error;
    }
}

/**
 * Gestione messaggi dal client
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

/**
 * Background Sync (per salvare note quando torna la connessione)
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-notes') {
        event.waitUntil(syncPendingNotes());
    }
});

/**
 * Sincronizza note in attesa
 */
async function syncPendingNotes() {
    // Implementazione futura: recupera note da IndexedDB e sincronizza
    console.log('[SW] Sincronizzazione note in background...');
}

/**
 * Notifiche push (preparato per uso futuro)
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    event.waitUntil(
        self.registration.showNotification(data.title || 'Scripta Manent', {
            body: data.body || '',
            icon: '/assets/icons/icon-192.png',
            badge: '/assets/icons/icon-72.png',
            tag: data.tag || 'general',
            data: data.data || {}
        })
    );
});

/**
 * Click su notifica
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Se c'è già una finestra aperta, focalizzala
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Altrimenti apri una nuova finestra
                if (clients.openWindow) {
                    const url = event.notification.data?.url || '/';
                    return clients.openWindow(url);
                }
            })
    );
});
