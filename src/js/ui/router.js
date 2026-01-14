/**
 * Router per Scripta Manent
 * Gestione navigazione hash-based
 */

/**
 * Router per Single Page Application
 */
export class Router {
    constructor(app) {
        this.app = app;
        this.routes = new Map();
        this.currentView = null;
        this.currentRoute = null;
        this.contentElement = null;
    }

    /**
     * Inizializza il router
     */
    init(contentSelector = '#main-content') {
        this.contentElement = document.querySelector(contentSelector);

        // Ascolta cambiamenti hash
        window.addEventListener('hashchange', () => this.handleRoute());

        // Gestisci route iniziale
        this.handleRoute();
    }

    /**
     * Registra una route
     * @param {string} path - Percorso (es. '/notes', '/notes/:id')
     * @param {Function} viewFactory - Factory che crea la view
     */
    register(path, viewFactory) {
        this.routes.set(path, viewFactory);
    }

    /**
     * Naviga a una route
     * @param {string} path - Percorso destinazione
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Gestisce il cambio di route
     */
    async handleRoute() {
        const hash = window.location.hash.slice(1) || '/';
        const { route, params } = this.matchRoute(hash);

        if (!route) {
            // Route non trovata, redirect a home
            this.navigate('/');
            return;
        }

        // Cleanup view precedente
        if (this.currentView && typeof this.currentView.destroy === 'function') {
            this.currentView.destroy();
        }

        // Crea nuova view
        const viewFactory = this.routes.get(route);
        if (!viewFactory) {
            this.navigate('/');
            return;
        }

        try {
            this.currentView = viewFactory(this.app);
            this.currentRoute = route;

            // Renderizza
            const html = await this.currentView.render(params);
            if (this.contentElement) {
                this.contentElement.innerHTML = html;
            }

            // Setup event listeners
            if (typeof this.currentView.setupEventListeners === 'function') {
                this.currentView.setupEventListeners();
            }

            // Aggiorna navigazione attiva
            this.updateActiveNav(hash);

            // Scroll to top
            window.scrollTo(0, 0);

            // Emetti evento
            this.app.emit('routeChange', { route, params, hash });

        } catch (error) {
            console.error('Errore navigazione:', error);
            this.showError('Errore durante il caricamento della pagina');
        }
    }

    /**
     * Trova la route corrispondente
     * @param {string} hash - Hash corrente
     * @returns {Object} Route e parametri
     */
    matchRoute(hash) {
        // Prima controlla route esatte
        if (this.routes.has(hash)) {
            return { route: hash, params: {} };
        }

        // Poi controlla route con parametri
        for (const [pattern, _] of this.routes) {
            const params = this.matchPattern(pattern, hash);
            if (params !== null) {
                return { route: pattern, params };
            }
        }

        return { route: null, params: {} };
    }

    /**
     * Match di un pattern con parametri
     * @param {string} pattern - Pattern route (es. '/notes/:id')
     * @param {string} path - Path da matchare
     * @returns {Object|null} Parametri estratti o null
     */
    matchPattern(pattern, path) {
        // Semplice pattern matching per :param
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');

        if (patternParts.length !== pathParts.length) {
            return null;
        }

        const params = {};

        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];

            if (patternPart.startsWith(':')) {
                // Parametro dinamico
                const paramName = patternPart.slice(1);
                params[paramName] = decodeURIComponent(pathPart);
            } else if (patternPart !== pathPart) {
                // Non corrisponde
                return null;
            }
        }

        return params;
    }

    /**
     * Aggiorna la navigazione attiva
     * @param {string} hash - Hash corrente
     */
    updateActiveNav(hash) {
        // Rimuovi active da tutti i link
        document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(link => {
            link.classList.remove('active');
        });

        // Trova il link corrispondente
        const basePath = '/' + hash.split('/')[1];

        document.querySelectorAll(`[href="#${basePath}"], [href="#${hash}"]`).forEach(link => {
            link.classList.add('active');
        });

        // Gestione speciale per home
        if (hash === '/' || hash === '') {
            document.querySelectorAll('[href="#/"]').forEach(link => {
                link.classList.add('active');
            });
        }
    }

    /**
     * Mostra errore
     */
    showError(message) {
        if (this.contentElement) {
            this.contentElement.innerHTML = `
                <div class="view">
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <div class="empty-state-title">Errore</div>
                        <p class="empty-state-text">${message}</p>
                        <a href="#/" class="btn btn-primary" style="margin-top: var(--space-md);">
                            Torna alla home
                        </a>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Ottiene la route corrente
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Ottiene la view corrente
     */
    getCurrentView() {
        return this.currentView;
    }

    /**
     * Refresh della view corrente
     */
    async refresh() {
        if (this.currentView && typeof this.currentView.refresh === 'function') {
            await this.currentView.refresh();
        } else {
            await this.handleRoute();
        }
    }
}

export default Router;
