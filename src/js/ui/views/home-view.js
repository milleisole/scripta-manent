/**
 * Home View per Scripta Manent
 * Dashboard con statistiche e accessi rapidi
 */

import { formatFileSize, formatDate } from '../../config.js';

/**
 * View della home/dashboard
 */
export class HomeView {
    constructor(app) {
        this.app = app;
    }

    /**
     * Renderizza la view
     * @returns {string}
     */
    async render() {
        const user = this.app.user;
        const stats = await this.getStats();
        const recentNotes = await this.getRecentNotes();
        const recentFiles = await this.getRecentFiles();

        const greeting = this.getGreeting();

        return `
            <div class="view home-view">
                <div class="dashboard-header">
                    <h1 class="dashboard-greeting">${greeting}, ${user?.name?.split(' ')[0] || 'Utente'}!</h1>
                    <p class="dashboard-date">${this.formatCurrentDate()}</p>
                </div>

                <div class="stats-grid">
                    <div class="card stat-card">
                        <div class="stat-value">${stats.notes}</div>
                        <div class="stat-label">Note</div>
                    </div>
                    <div class="card stat-card">
                        <div class="stat-value">${stats.files}</div>
                        <div class="stat-label">File</div>
                    </div>
                    <div class="card stat-card">
                        <div class="stat-value">${stats.media}</div>
                        <div class="stat-label">Media</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-header">
                        <h2 class="section-title">Note recenti</h2>
                        <a href="#/notes" class="section-link">Vedi tutte</a>
                    </div>
                    <div class="notes-grid">
                        ${recentNotes.length > 0 ? recentNotes.map(note => this.renderNoteCard(note)).join('') : `
                            <div class="card" style="grid-column: 1 / -1;">
                                <p class="text-muted text-center">Nessuna nota ancora. Creane una!</p>
                            </div>
                        `}
                    </div>
                </div>

                <div class="section">
                    <div class="section-header">
                        <h2 class="section-title">File recenti</h2>
                        <a href="#/files" class="section-link">Vedi tutti</a>
                    </div>
                    <div class="files-list">
                        ${recentFiles.length > 0 ? recentFiles.map(file => this.renderFileCard(file)).join('') : `
                            <div class="card">
                                <p class="text-muted text-center">Nessun file ancora. Caricane uno!</p>
                            </div>
                        `}
                    </div>
                </div>

                <div class="section">
                    <div class="section-header">
                        <h2 class="section-title">Azioni rapide</h2>
                    </div>
                    <div class="quick-actions" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-md);">
                        <button class="card card-clickable" data-action="new-note" style="text-align: center; padding: var(--space-lg);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin: 0 auto var(--space-sm);">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                <polyline points="14,2 14,8 20,8"/>
                                <line x1="12" y1="18" x2="12" y2="12"/>
                                <line x1="9" y1="15" x2="15" y2="15"/>
                            </svg>
                            <span>Nuova nota</span>
                        </button>
                        <button class="card card-clickable" data-action="upload-file" style="text-align: center; padding: var(--space-lg);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin: 0 auto var(--space-sm);">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="17,8 12,3 7,8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            <span>Carica file</span>
                        </button>
                        <button class="card card-clickable" data-action="upload-media" style="text-align: center; padding: var(--space-lg);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin: 0 auto var(--space-sm);">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21,15 16,10 5,21"/>
                            </svg>
                            <span>Carica media</span>
                        </button>
                        <button class="card card-clickable" data-action="import-folder" style="text-align: center; padding: var(--space-lg);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin: 0 auto var(--space-sm);">
                                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                                <polyline points="12,11 12,17"/>
                                <polyline points="9,14 12,11 15,14"/>
                            </svg>
                            <span>Importa cartella</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizza una card nota
     */
    renderNoteCard(note) {
        return `
            <div class="card card-clickable note-card" data-note-id="${note.id}">
                <div class="note-card-title">${this.escapeHtml(note.name)}</div>
                <div class="note-card-preview">${this.escapeHtml(note.getPreview ? note.getPreview() : '')}</div>
                <div class="note-card-meta">
                    <span>${formatDate(note.updated)}</span>
                    ${note.encrypted ? `
                        <span class="tag tag-encrypted">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0110 0v4"/>
                            </svg>
                            Cifrato
                        </span>
                    ` : ''}
                </div>
                ${note.tags?.length > 0 ? `
                    <div class="note-card-tags">
                        ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Renderizza una card file
     */
    renderFileCard(file) {
        return `
            <div class="card card-clickable file-card" data-file-id="${file.id}">
                <div class="file-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
                        <polyline points="13,2 13,9 20,9"/>
                    </svg>
                </div>
                <div class="file-card-info">
                    <div class="file-card-name">${this.escapeHtml(file.name)}</div>
                    <div class="file-card-size">${formatFileSize(file.size)} · ${formatDate(file.updated)}</div>
                </div>
            </div>
        `;
    }

    /**
     * Ottiene le statistiche
     */
    async getStats() {
        try {
            const notesStats = this.app.notesService ? await this.app.notesService.getStats() : { total: 0 };
            const filesStats = this.app.filesService ? await this.app.filesService.getStats() : { totalFiles: 0, totalMedia: 0 };

            return {
                notes: notesStats.total || 0,
                files: filesStats.totalFiles || 0,
                media: filesStats.totalMedia || 0
            };
        } catch {
            return { notes: 0, files: 0, media: 0 };
        }
    }

    /**
     * Ottiene le note recenti
     */
    async getRecentNotes() {
        try {
            if (!this.app.notesService) return [];
            return await this.app.notesService.list({ limit: 3, sortBy: 'updated', sortOrder: 'desc' });
        } catch {
            return [];
        }
    }

    /**
     * Ottiene i file recenti
     */
    async getRecentFiles() {
        try {
            if (!this.app.filesService) return [];
            return await this.app.filesService.listFiles({ limit: 3, sortBy: 'updated', sortOrder: 'desc' });
        } catch {
            return [];
        }
    }

    /**
     * Ottiene il saluto in base all'ora
     */
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buongiorno';
        if (hour < 18) return 'Buon pomeriggio';
        return 'Buonasera';
    }

    /**
     * Formatta la data corrente
     */
    formatCurrentDate() {
        return new Date().toLocaleDateString('it-IT', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Configura event listeners dopo il rendering
     */
    setupEventListeners() {
        // Click su nota
        document.querySelectorAll('[data-note-id]').forEach(card => {
            card.addEventListener('click', () => {
                window.location.hash = `#/notes/${card.dataset.noteId}`;
            });
        });

        // Click su file
        document.querySelectorAll('[data-file-id]').forEach(card => {
            card.addEventListener('click', () => {
                this.app.openFile(card.dataset.fileId);
            });
        });

        // Azioni rapide
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.app.handleAction(btn.dataset.action);
            });
        });
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

export default HomeView;
