/**
 * Scripta Manent - Main Application
 * Entry point dell'applicazione
 */

import { CONFIG, generateUUID, debounce } from './config.js';
import { StorageFactory } from './storage/storage-interface.js';
import { KeyManager } from './crypto/key-manager.js';
import { NotesService } from './services/notes-service.js';
import { FilesService } from './services/files-service.js';
import { SearchService } from './services/search-service.js';
import { TrashService } from './services/trash-service.js';
import { ShareService } from './services/share-service.js';
import { Router } from './ui/router.js';
import { Modal } from './ui/components/modal.js';
import { Toast } from './ui/components/toast.js';

// Views
import { HomeView } from './ui/views/home-view.js';
import { NotesView } from './ui/views/notes-view.js';
import { NoteEditorView } from './ui/views/note-editor-view.js';
import { FilesView } from './ui/views/files-view.js';
import { MediaView } from './ui/views/media-view.js';
import { TrashView } from './ui/views/trash-view.js';
import { SettingsView } from './ui/views/settings-view.js';

/**
 * Applicazione principale
 */
class App {
    constructor() {
        // Stato
        this.user = null;
        this.isAuthenticated = false;
        this.isOnline = navigator.onLine;

        // Impostazioni
        this.settings = this.loadSettings();

        // Servizi (inizializzati dopo auth)
        this.storage = null;
        this.keyManager = null;
        this.notesService = null;
        this.filesService = null;
        this.searchService = null;
        this.trashService = null;
        this.shareService = null;

        // UI
        this.router = new Router(this);
        this.modal = null;
        this.toast = null;

        // Event listeners
        this.eventListeners = new Map();

        // Bind methods
        this.handleOnline = this.handleOnline.bind(this);
        this.handleOffline = this.handleOffline.bind(this);
    }

    /**
     * Inizializza l'applicazione
     */
    async init() {
        try {
            // Registra Service Worker
            await this.registerServiceWorker();

            // Inizializza UI
            this.initUI();

            // Applica tema
            this.applyTheme();

            // Configura router
            this.setupRoutes();

            // Event listeners globali
            this.setupGlobalListeners();

            // Controlla autenticazione
            await this.checkAuth();

            // Inizializza PWA install prompt
            this.setupInstallPrompt();

            console.log('Scripta Manent inizializzato');
        } catch (error) {
            console.error('Errore inizializzazione:', error);
            this.toast?.error('Errore durante l\'avvio dell\'applicazione');
        }
    }

    /**
     * Registra il Service Worker
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registrato:', registration.scope);

                // Ascolta aggiornamenti
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker?.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });
            } catch (error) {
                console.error('Errore registrazione SW:', error);
            }
        }
    }

    /**
     * Inizializza componenti UI
     */
    initUI() {
        // Modal
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            this.modal = new Modal(modalContainer);
        }

        // Toast
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            this.toast = new Toast(toastContainer);
        }

        // Menu laterale toggle
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');

        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Chiudi sidebar al click fuori
            document.addEventListener('click', (e) => {
                if (sidebar.classList.contains('open') &&
                    !sidebar.contains(e.target) &&
                    !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            });
        }

        // FAB menu
        this.setupFabMenu();

        // Aggiorna indicatore online
        this.updateOnlineStatus();
    }

    /**
     * Configura il menu FAB
     */
    setupFabMenu() {
        const fab = document.getElementById('fab');
        const fabMenu = document.getElementById('fab-menu');

        if (fab && fabMenu) {
            fab.addEventListener('click', () => {
                fab.classList.toggle('active');
                fabMenu.classList.toggle('open');
            });

            // Chiudi al click fuori
            document.addEventListener('click', (e) => {
                if (!fab.contains(e.target) && !fabMenu.contains(e.target)) {
                    fab.classList.remove('active');
                    fabMenu.classList.remove('open');
                }
            });

            // Gestisci azioni FAB
            fabMenu.querySelectorAll('[data-action]').forEach(item => {
                item.addEventListener('click', () => {
                    const action = item.dataset.action;
                    this.handleAction(action);
                    fab.classList.remove('active');
                    fabMenu.classList.remove('open');
                });
            });
        }
    }

    /**
     * Configura le routes
     */
    setupRoutes() {
        this.router.register('/', (app) => new HomeView(app));
        this.router.register('/notes', (app) => new NotesView(app));
        this.router.register('/notes/:id', (app) => new NoteEditorView(app));
        this.router.register('/files', (app) => new FilesView(app));
        this.router.register('/media', (app) => new MediaView(app));
        this.router.register('/trash', (app) => new TrashView(app));
        this.router.register('/settings', (app) => new SettingsView(app));

        this.router.init('#main-content');
    }

    /**
     * Configura listeners globali
     */
    setupGlobalListeners() {
        // Online/Offline
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: Salva
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const view = this.router.getCurrentView();
                if (view?.editor?.save) {
                    view.editor.save();
                }
            }

            // Ctrl/Cmd + N: Nuova nota
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.router.navigate('/notes/new');
            }

            // Escape: Chiudi modal
            if (e.key === 'Escape') {
                this.modal?.close();
            }
        });

        // Gestisci beforeunload per salvare modifiche
        window.addEventListener('beforeunload', (e) => {
            const view = this.router.getCurrentView();
            if (view?.editor?.isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    /**
     * Verifica autenticazione
     */
    async checkAuth() {
        // Controlla se abbiamo un token salvato
        const token = localStorage.getItem('scripta_access_token');
        const expiry = localStorage.getItem('scripta_token_expiry');

        if (token && expiry && Date.now() < parseInt(expiry)) {
            // Token valido, inizializza servizi
            await this.initializeWithToken(token);
        } else {
            // Mostra schermata login
            this.showLoginScreen();
        }
    }

    /**
     * Inizializza con token
     */
    async initializeWithToken(token) {
        try {
            // Ottieni info utente
            const userInfo = await this.getUserInfo(token);
            if (!userInfo) {
                throw new Error('Impossibile ottenere info utente');
            }

            this.user = userInfo;
            this.isAuthenticated = true;

            // Inizializza storage
            this.storage = StorageFactory.create('googledrive', {
                accessToken: token
            });

            // Inizializza servizi
            await this.initServices();

            // Mostra app
            this.showApp();

            // Sincronizza
            this.sync();

        } catch (error) {
            console.error('Errore inizializzazione:', error);
            this.logout();
        }
    }

    /**
     * Ottiene info utente da Google
     */
    async getUserInfo(token) {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Token non valido');
            }

            return await response.json();
        } catch (error) {
            console.error('Errore getUserInfo:', error);
            return null;
        }
    }

    /**
     * Inizializza tutti i servizi
     */
    async initServices() {
        // Key Manager
        this.keyManager = new KeyManager(this.storage);

        // Services
        this.searchService = new SearchService(this.storage);
        this.trashService = new TrashService(this.storage);
        this.notesService = new NotesService(this.storage, this.keyManager, this.searchService);
        this.filesService = new FilesService(this.storage, this.keyManager);
        this.shareService = new ShareService(this.storage);

        // Carica indice di ricerca
        await this.searchService.loadIndex();

        // Pulizia automatica cestino
        await this.trashService.cleanupExpired();
    }

    /**
     * Mostra schermata di login
     */
    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const appScreen = document.getElementById('app');

        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appScreen) appScreen.classList.add('hidden');

        // Gestisci click su login
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.login());
        }
    }

    /**
     * Mostra l'app
     */
    showApp() {
        const loginScreen = document.getElementById('login-screen');
        const appScreen = document.getElementById('app');

        if (loginScreen) loginScreen.classList.add('hidden');
        if (appScreen) appScreen.classList.remove('hidden');

        // Aggiorna info utente nella sidebar
        this.updateUserInfo();

        // Aggiorna indicatore sync
        this.updateSyncStatus();
    }

    /**
     * Login con Google OAuth
     */
    async login() {
        try {
            // Genera code verifier e challenge per PKCE
            const codeVerifier = this.generateCodeVerifier();
            const codeChallenge = await this.generateCodeChallenge(codeVerifier);

            // Salva verifier per dopo
            sessionStorage.setItem('code_verifier', codeVerifier);

            // Costruisci URL OAuth
            const params = new URLSearchParams({
                client_id: CONFIG.GOOGLE.CLIENT_ID,
                redirect_uri: CONFIG.GOOGLE.REDIRECT_URI,
                response_type: 'code',
                scope: CONFIG.GOOGLE.SCOPES.join(' '),
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
                access_type: 'offline',
                prompt: 'consent'
            });

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

            // Apri popup
            const popup = window.open(authUrl, 'google-auth', 'width=500,height=600');

            // Ascolta messaggio di ritorno
            window.addEventListener('message', async (event) => {
                if (event.origin !== window.location.origin) return;

                if (event.data.type === 'oauth-callback' && event.data.code) {
                    popup?.close();
                    await this.handleOAuthCallback(event.data.code, codeVerifier);
                }
            }, { once: true });

        } catch (error) {
            console.error('Errore login:', error);
            this.toast?.error('Errore durante il login');
        }
    }

    /**
     * Gestisce callback OAuth
     */
    async handleOAuthCallback(code, codeVerifier) {
        try {
            // Scambia code per token
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: CONFIG.GOOGLE.CLIENT_ID,
                    code: code,
                    code_verifier: codeVerifier,
                    grant_type: 'authorization_code',
                    redirect_uri: CONFIG.GOOGLE.REDIRECT_URI
                })
            });

            if (!response.ok) {
                throw new Error('Errore scambio token');
            }

            const tokens = await response.json();

            // Salva tokens
            localStorage.setItem('scripta_access_token', tokens.access_token);
            localStorage.setItem('scripta_refresh_token', tokens.refresh_token);
            localStorage.setItem('scripta_token_expiry', Date.now() + (tokens.expires_in * 1000));

            // Inizializza app
            await this.initializeWithToken(tokens.access_token);

            this.toast?.success('Login effettuato con successo');

        } catch (error) {
            console.error('Errore OAuth callback:', error);
            this.toast?.error('Errore durante l\'autenticazione');
        }
    }

    /**
     * Genera code verifier per PKCE
     */
    generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    /**
     * Genera code challenge per PKCE
     */
    async generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    /**
     * Logout
     */
    async logout() {
        // Revoca token
        const token = localStorage.getItem('scripta_access_token');
        if (token) {
            try {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
                    method: 'POST'
                });
            } catch {
                // Ignora errori revoca
            }
        }

        // Pulisci storage
        localStorage.removeItem('scripta_access_token');
        localStorage.removeItem('scripta_refresh_token');
        localStorage.removeItem('scripta_token_expiry');
        sessionStorage.clear();

        // Reset stato
        this.user = null;
        this.isAuthenticated = false;
        this.storage = null;
        this.notesService = null;
        this.filesService = null;
        this.searchService = null;
        this.trashService = null;

        // Mostra login
        this.showLoginScreen();
    }

    /**
     * Refresh del token
     */
    async refreshToken() {
        const refreshToken = localStorage.getItem('scripta_refresh_token');
        if (!refreshToken) {
            this.logout();
            return null;
        }

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: CONFIG.GOOGLE.CLIENT_ID,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                })
            });

            if (!response.ok) {
                throw new Error('Refresh token non valido');
            }

            const tokens = await response.json();

            // Aggiorna tokens
            localStorage.setItem('scripta_access_token', tokens.access_token);
            localStorage.setItem('scripta_token_expiry', Date.now() + (tokens.expires_in * 1000));

            // Aggiorna storage
            if (this.storage) {
                this.storage.accessToken = tokens.access_token;
            }

            return tokens.access_token;

        } catch (error) {
            console.error('Errore refresh token:', error);
            this.logout();
            return null;
        }
    }

    /**
     * Sincronizza dati
     */
    async sync() {
        if (!this.isAuthenticated || !this.isOnline) return;

        try {
            this.updateSyncStatus('syncing');

            // Sincronizza indice di ricerca
            await this.searchService?.saveIndex();

            // Pulisci cestino
            await this.trashService?.cleanupExpired();

            this.updateSyncStatus('synced');
            this.emit('sync');

        } catch (error) {
            console.error('Errore sync:', error);
            this.updateSyncStatus('error');
        }
    }

    /**
     * Gestisce azioni globali
     */
    async handleAction(action) {
        switch (action) {
            case 'new-note':
                this.router.navigate('/notes/new');
                break;

            case 'upload-file':
            case 'upload-media':
                this.showFileUpload(action === 'upload-media');
                break;

            case 'search':
                this.showSearch();
                break;

            case 'sync':
                await this.sync();
                this.toast?.success('Sincronizzazione completata');
                break;
        }
    }

    /**
     * Mostra dialog upload file
     */
    showFileUpload(mediaOnly = false) {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;

        if (mediaOnly) {
            input.accept = 'image/*,video/*';
        }

        input.addEventListener('change', async () => {
            const files = Array.from(input.files || []);
            if (files.length === 0) return;

            for (const file of files) {
                try {
                    this.toast?.info(`Caricamento ${file.name}...`);

                    if (mediaOnly || file.type.startsWith('image/') || file.type.startsWith('video/')) {
                        await this.filesService.uploadMedia(file);
                    } else {
                        await this.filesService.uploadFile(file);
                    }

                    this.toast?.success(`${file.name} caricato`);
                } catch (error) {
                    this.toast?.error(`Errore caricamento ${file.name}`);
                }
            }

            // Refresh view
            this.router.refresh();
        });

        input.click();
    }

    /**
     * Mostra ricerca globale
     */
    async showSearch() {
        const query = await this.modal?.prompt('Cerca', {
            placeholder: 'Cerca note e file...',
            message: 'Inserisci il termine di ricerca'
        });

        if (query) {
            const results = await this.searchService?.search(query);

            if (!results || results.length === 0) {
                this.toast?.info('Nessun risultato trovato');
                return;
            }

            // Mostra risultati
            this.showSearchResults(results, query);
        }
    }

    /**
     * Mostra risultati ricerca
     */
    showSearchResults(results, query) {
        const body = document.createElement('div');
        body.className = 'search-results';

        if (results.length === 0) {
            body.innerHTML = '<p class="text-muted">Nessun risultato trovato</p>';
        } else {
            body.innerHTML = results.map(result => `
                <a href="#/notes/${result.id}" class="search-result-item" onclick="this.closest('.modal').querySelector('.modal-close')?.click()">
                    <div class="search-result-title">${this.escapeHtml(result.name)}</div>
                    ${result.preview ? `<div class="search-result-preview">${this.escapeHtml(result.preview)}</div>` : ''}
                </a>
            `).join('');
        }

        this.modal?.open({
            title: `Risultati per "${query}"`,
            body,
            className: 'search-modal'
        });
    }

    /**
     * Impostazioni
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('scripta_settings');
            return saved ? { ...CONFIG.DEFAULT_SETTINGS, ...JSON.parse(saved) } : CONFIG.DEFAULT_SETTINGS;
        } catch {
            return CONFIG.DEFAULT_SETTINGS;
        }
    }

    saveSettings() {
        localStorage.setItem('scripta_settings', JSON.stringify(this.settings));
    }

    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        this.emit('settingsChange', { key, value });
    }

    /**
     * Gestione tema
     */
    setTheme(theme) {
        this.settings.theme = theme;
        this.saveSettings();
        this.applyTheme();
    }

    applyTheme() {
        const theme = this.settings.theme;
        const html = document.documentElement;

        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            html.setAttribute('data-theme', theme);
        }
    }

    /**
     * Gestione lingua
     */
    setLanguage(lang) {
        this.settings.language = lang;
        this.saveSettings();
        // TODO: implementare i18n
    }

    /**
     * Gestione online/offline
     */
    handleOnline() {
        this.isOnline = true;
        this.updateOnlineStatus();
        this.sync();
        this.toast?.success('Connessione ripristinata');
    }

    handleOffline() {
        this.isOnline = false;
        this.updateOnlineStatus();
        this.toast?.warning('Sei offline');
    }

    updateOnlineStatus() {
        const indicator = document.getElementById('sync-status');
        if (indicator) {
            indicator.classList.toggle('offline', !this.isOnline);
        }
    }

    updateSyncStatus(status = 'idle') {
        const indicator = document.getElementById('sync-status');
        if (indicator) {
            indicator.className = 'sync-indicator ' + status;
        }
    }

    /**
     * Aggiorna info utente UI
     */
    updateUserInfo() {
        const userAvatar = document.querySelector('.user-avatar');
        const userName = document.querySelector('.user-name');
        const userEmail = document.querySelector('.user-email');

        if (this.user) {
            if (userAvatar && this.user.picture) {
                userAvatar.innerHTML = `<img src="${this.user.picture}" alt="${this.user.name}">`;
            }
            if (userName) userName.textContent = this.user.name || 'Utente';
            if (userEmail) userEmail.textContent = this.user.email || '';
        }
    }

    /**
     * Setup PWA install prompt
     */
    setupInstallPrompt() {
        let deferredPrompt = null;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // Mostra button installa
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.classList.remove('hidden');
                installBtn.addEventListener('click', async () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const result = await deferredPrompt.userChoice;
                        if (result.outcome === 'accepted') {
                            this.toast?.success('App installata!');
                        }
                        deferredPrompt = null;
                        installBtn.classList.add('hidden');
                    }
                });
            }
        });
    }

    /**
     * Mostra notifica aggiornamento
     */
    showUpdateNotification() {
        this.toast?.info('Nuova versione disponibile. Ricarica per aggiornare.', {
            duration: 0,
            action: {
                text: 'Aggiorna',
                onClick: () => window.location.reload()
            }
        });
    }

    /**
     * Event emitter semplice
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) listeners.splice(index, 1);
        }
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(cb => cb(data));
        }
    }

    /**
     * Utility: escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Inizializza app quando DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

// Gestisci callback OAuth (per redirect)
if (window.location.pathname === '/oauth-callback' || window.location.search.includes('code=')) {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code && window.opener) {
        // Invia code alla finestra principale
        window.opener.postMessage({ type: 'oauth-callback', code }, window.location.origin);
        window.close();
    }
}

export { App };
