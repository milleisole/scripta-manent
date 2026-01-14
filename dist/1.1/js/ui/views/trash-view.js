/**
 * Trash View per Scripta Manent
 * Gestione cestino
 */

import { formatFileSize, formatDate } from '../../config.js';

/**
 * View del cestino
 */
export class TrashView {
    constructor(app) {
        this.app = app;
        this.items = [];
    }

    /**
     * Renderizza la view
     */
    async render() {
        this.items = await this.loadTrash();

        return `
            <div class="view trash-view">
                <div class="view-header">
                    <div>
                        <h1 class="view-title">Cestino</h1>
                        <p class="view-subtitle">${this.items.length} elementi</p>
                    </div>
                    ${this.items.length > 0 ? `
                        <button class="btn btn-danger" data-action="empty-trash">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                            Svuota cestino
                        </button>
                    ` : ''}
                </div>

                <div class="trash-info card" style="margin-bottom: var(--space-lg);">
                    <div style="display: flex; align-items: center; gap: var(--space-md);">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px; color: var(--color-warning);">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <p class="text-muted" style="margin: 0;">
                            Gli elementi nel cestino vengono eliminati automaticamente dopo 15 giorni.
                        </p>
                    </div>
                </div>

                <div id="trash-list">
                    ${this.renderTrashList()}
                </div>
            </div>
        `;
    }

    /**
     * Renderizza la lista del cestino
     */
    renderTrashList() {
        if (this.items.length === 0) {
            return `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                    <div class="empty-state-title">Cestino vuoto</div>
                    <p class="empty-state-text">Gli elementi eliminati appariranno qui</p>
                </div>
            `;
        }

        return `
            <div class="files-list">
                ${this.items.map(item => this.renderTrashItem(item)).join('')}
            </div>
        `;
    }

    /**
     * Renderizza un item del cestino
     */
    renderTrashItem(item) {
        const latestVersion = item.versions[0];

        return `
            <div class="card trash-item" data-id="${item.id}">
                <div class="file-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
                        <polyline points="13,2 13,9 20,9"/>
                    </svg>
                </div>
                <div class="trash-item-info">
                    <div class="trash-item-name">${this.escapeHtml(latestVersion.name)}</div>
                    <div class="trash-item-meta">
                        Eliminato ${formatDate(latestVersion.timestamp)} ·
                        ${formatFileSize(latestVersion.size || 0)} ·
                        ${item.versions.length} version${item.versions.length > 1 ? 'i' : 'e'}
                    </div>
                </div>
                <div class="trash-item-actions">
                    <button class="btn btn-sm btn-secondary" data-action="restore" data-id="${item.id}" data-file-id="${latestVersion.fileId}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                            <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                        </svg>
                        Ripristina
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-permanent" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        Elimina
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Carica il cestino
     */
    async loadTrash() {
        try {
            if (!this.app.trashService) return [];
            return await this.app.trashService.list();
        } catch (error) {
            console.error('Errore caricamento cestino:', error);
            return [];
        }
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Ripristina
        document.querySelectorAll('[data-action="restore"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const fileId = btn.dataset.fileId;
                await this.restoreItem(id, fileId);
            });
        });

        // Elimina permanentemente
        document.querySelectorAll('[data-action="delete-permanent"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await this.deletePermanently(id);
            });
        });

        // Svuota cestino
        document.querySelectorAll('[data-action="empty-trash"]').forEach(btn => {
            btn.addEventListener('click', () => this.emptyTrash());
        });
    }

    /**
     * Ripristina un item
     */
    async restoreItem(itemId, fileId) {
        try {
            // Determina la cartella di destinazione
            const item = this.items.find(i => i.id === itemId);
            const meta = item?.versions[0]?.meta;

            let destinationFolderId;
            if (meta?.type === 'note') {
                destinationFolderId = await this.app.storage.getSystemFolderId('notes');
            } else if (meta?.type === 'media') {
                destinationFolderId = await this.app.storage.getSystemFolderId('media');
            } else {
                destinationFolderId = await this.app.storage.getSystemFolderId('files');
            }

            await this.app.trashService.restore(itemId, fileId, destinationFolderId);
            this.app.toast.success('Elemento ripristinato');
            this.refresh();
        } catch (error) {
            console.error('Errore ripristino:', error);
            this.app.toast.error('Errore durante il ripristino');
        }
    }

    /**
     * Elimina permanentemente
     */
    async deletePermanently(itemId) {
        const confirmed = await this.app.modal.confirm(
            'Elimina permanentemente',
            'Questa azione non può essere annullata. Continuare?',
            { danger: true, confirmText: 'Elimina' }
        );

        if (confirmed) {
            try {
                await this.app.trashService.deletePermanently(itemId);
                this.app.toast.success('Elemento eliminato permanentemente');
                this.refresh();
            } catch (error) {
                this.app.toast.error('Errore durante l\'eliminazione');
            }
        }
    }

    /**
     * Svuota il cestino
     */
    async emptyTrash() {
        const confirmed = await this.app.modal.confirm(
            'Svuota cestino',
            'Tutti gli elementi nel cestino verranno eliminati permanentemente. Continuare?',
            { danger: true, confirmText: 'Svuota' }
        );

        if (confirmed) {
            try {
                const count = await this.app.trashService.emptyTrash();
                this.app.toast.success(`${count} elementi eliminati`);
                this.refresh();
            } catch (error) {
                this.app.toast.error('Errore durante lo svuotamento');
            }
        }
    }

    /**
     * Refresh
     */
    async refresh() {
        this.items = await this.loadTrash();
        const container = document.getElementById('trash-list');
        if (container) {
            container.innerHTML = this.renderTrashList();
            this.setupEventListeners();
        }
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

export default TrashView;
