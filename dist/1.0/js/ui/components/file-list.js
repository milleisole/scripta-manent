/**
 * Componente FileList per Scripta Manent
 * Lista di file con azioni
 */

import { formatFileSize, formatDate } from '../../config.js';

/**
 * Classe per renderizzare liste di file
 */
export class FileList {
    /**
     * @param {HTMLElement} container
     * @param {Object} options
     */
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            onItemClick: null,
            onItemAction: null,
            showActions: true,
            emptyMessage: 'Nessun file',
            ...options
        };

        this.items = [];
    }

    /**
     * Renderizza la lista di file
     * @param {Array} items - Array di FileItem
     */
    render(items) {
        this.items = items;

        if (!items || items.length === 0) {
            this.container.innerHTML = this.renderEmpty();
            return;
        }

        this.container.innerHTML = `
            <div class="files-list">
                ${items.map(item => this.renderItem(item)).join('')}
            </div>
        `;

        this.setupEventListeners();
    }

    /**
     * Renderizza un singolo item
     * @param {Object} item
     * @returns {string}
     */
    renderItem(item) {
        const icon = this.getIcon(item);
        const size = formatFileSize(item.size);
        const date = formatDate(item.updated);

        return `
            <div class="card card-clickable file-card" data-id="${item.id}">
                <div class="file-card-icon ${item.isImage() ? 'image' : ''}"
                     ${item.isImage() && item.thumbnail ? `style="background-image: url(${item.thumbnail})"` : ''}>
                    ${!item.isImage() || !item.thumbnail ? icon : ''}
                </div>
                <div class="file-card-info">
                    <div class="file-card-name">${this.escapeHtml(item.name)}</div>
                    <div class="file-card-size">${size} · ${date}</div>
                    ${item.tags.length > 0 ? `
                        <div class="note-card-tags">
                            ${item.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                ${item.encrypted ? `
                    <span class="tag tag-encrypted">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        Cifrato
                    </span>
                ` : ''}
                ${this.options.showActions ? `
                    <div class="file-card-actions">
                        <button class="icon-btn icon-btn-small" data-action="download" data-id="${item.id}" title="Scarica">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7,10 12,15 17,10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </button>
                        <button class="icon-btn icon-btn-small" data-action="share" data-id="${item.id}" title="Condividi">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"/>
                                <circle cx="6" cy="12" r="3"/>
                                <circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                        </button>
                        <button class="icon-btn icon-btn-small" data-action="delete" data-id="${item.id}" title="Elimina">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Renderizza stato vuoto
     * @returns {string}
     */
    renderEmpty() {
        return `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
                <div class="empty-state-title">${this.options.emptyMessage}</div>
                <p class="empty-state-text">I file che carichi appariranno qui</p>
            </div>
        `;
    }

    /**
     * Ottiene l'icona per un tipo di file
     * @param {Object} item
     * @returns {string}
     */
    getIcon(item) {
        const icons = {
            image: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                </svg>
            `,
            video: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="23,7 16,12 23,17 23,7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
            `,
            audio: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                </svg>
            `,
            pdf: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
            `,
            document: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10,9 9,9 8,9"/>
                </svg>
            `,
            archive: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="21,8 21,21 3,21 3,8"/>
                    <rect x="1" y="3" width="22" height="5"/>
                    <line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
            `,
            code: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16,18 22,12 16,6"/>
                    <polyline points="8,6 2,12 8,18"/>
                </svg>
            `,
            file: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
                    <polyline points="13,2 13,9 20,9"/>
                </svg>
            `
        };

        const iconName = item.getIconName ? item.getIconName() : 'file';
        return icons[iconName] || icons.file;
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Click su item
        this.container.querySelectorAll('.file-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Ignora se click su azione
                if (e.target.closest('[data-action]')) return;

                const id = card.dataset.id;
                const item = this.items.find(i => i.id === id);
                if (item && this.options.onItemClick) {
                    this.options.onItemClick(item);
                }
            });
        });

        // Click su azioni
        this.container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const item = this.items.find(i => i.id === id);

                if (item && this.options.onItemAction) {
                    this.options.onItemAction(action, item);
                }
            });
        });
    }

    /**
     * Aggiorna un singolo item
     * @param {Object} item
     */
    updateItem(item) {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index > -1) {
            this.items[index] = item;
            const card = this.container.querySelector(`[data-id="${item.id}"]`);
            if (card) {
                card.outerHTML = this.renderItem(item);
                this.setupEventListeners();
            }
        }
    }

    /**
     * Rimuove un item dalla lista
     * @param {string} itemId
     */
    removeItem(itemId) {
        this.items = this.items.filter(i => i.id !== itemId);
        this.render(this.items);
    }

    /**
     * Aggiunge un item alla lista
     * @param {Object} item
     */
    addItem(item) {
        this.items.unshift(item);
        this.render(this.items);
    }

    /**
     * Escape HTML
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default FileList;
