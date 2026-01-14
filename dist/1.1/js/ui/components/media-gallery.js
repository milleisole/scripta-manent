/**
 * Componente MediaGallery per Scripta Manent
 * Galleria di immagini e video
 */

import { formatFileSize, formatDate } from '../../config.js';

/**
 * Classe per la galleria media
 */
export class MediaGallery {
    /**
     * @param {HTMLElement} container
     * @param {Object} options
     */
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            onItemClick: null,
            onItemAction: null,
            columns: 'auto', // 'auto', 2, 3, 4, etc.
            emptyMessage: 'Nessun media',
            ...options
        };

        this.items = [];
    }

    /**
     * Renderizza la galleria
     * @param {Array} items - Array di FileItem (solo media)
     */
    render(items) {
        this.items = items;

        if (!items || items.length === 0) {
            this.container.innerHTML = this.renderEmpty();
            return;
        }

        const gridStyle = this.options.columns !== 'auto'
            ? `grid-template-columns: repeat(${this.options.columns}, 1fr)`
            : '';

        this.container.innerHTML = `
            <div class="media-grid" style="${gridStyle}">
                ${items.map(item => this.renderItem(item)).join('')}
            </div>
        `;

        this.setupEventListeners();
        this.loadThumbnails();
    }

    /**
     * Renderizza un singolo item
     * @param {Object} item
     * @returns {string}
     */
    renderItem(item) {
        const isVideo = item.isVideo();
        const duration = item.getFormattedDuration ? item.getFormattedDuration() : null;

        return `
            <div class="media-item" data-id="${item.id}">
                <div class="media-thumbnail" data-file-id="${item.contentFileId}">
                    ${isVideo ? `
                        <div class="media-video-indicator">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5,3 19,12 5,21 5,3"/>
                            </svg>
                            ${duration ? `<span>${duration}</span>` : ''}
                        </div>
                    ` : ''}
                    <div class="media-loading">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                <div class="media-item-overlay">
                    <div class="media-item-name">${this.escapeHtml(item.name)}</div>
                    <div class="media-item-actions">
                        <button class="icon-btn icon-btn-small" data-action="download" data-id="${item.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7,10 12,15 17,10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </button>
                        <button class="icon-btn icon-btn-small" data-action="share" data-id="${item.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"/>
                                <circle cx="6" cy="12" r="3"/>
                                <circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                        </button>
                        <button class="icon-btn icon-btn-small" data-action="delete" data-id="${item.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
                ${item.encrypted ? `
                    <div class="media-encrypted-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
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
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                </svg>
                <div class="empty-state-title">${this.options.emptyMessage}</div>
                <p class="empty-state-text">Le immagini e i video che carichi appariranno qui</p>
            </div>
        `;
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Click su item
        this.container.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Ignora se click su azione
                if (e.target.closest('[data-action]')) return;

                const id = item.dataset.id;
                const mediaItem = this.items.find(i => i.id === id);
                if (mediaItem && this.options.onItemClick) {
                    this.options.onItemClick(mediaItem);
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
     * Carica le thumbnail per i media
     */
    async loadThumbnails() {
        const thumbnails = this.container.querySelectorAll('.media-thumbnail');

        for (const thumb of thumbnails) {
            const fileId = thumb.dataset.fileId;
            const item = this.items.find(i => i.contentFileId === fileId);

            if (item && this.options.getThumbnailUrl) {
                try {
                    const url = await this.options.getThumbnailUrl(item.id);
                    if (url) {
                        this.setThumbnailImage(thumb, url, item.isVideo());
                    } else {
                        this.setThumbnailPlaceholder(thumb, item);
                    }
                } catch (error) {
                    this.setThumbnailPlaceholder(thumb, item);
                }
            } else {
                this.setThumbnailPlaceholder(thumb, item);
            }
        }
    }

    /**
     * Imposta l'immagine thumbnail
     * @param {HTMLElement} thumb
     * @param {string} url
     * @param {boolean} isVideo
     */
    setThumbnailImage(thumb, url, isVideo) {
        const loading = thumb.querySelector('.media-loading');
        if (loading) loading.remove();

        if (isVideo) {
            thumb.innerHTML = `
                <video src="${url}" preload="metadata"></video>
                ${thumb.innerHTML}
            `;
        } else {
            thumb.style.backgroundImage = `url(${url})`;
            thumb.style.backgroundSize = 'cover';
            thumb.style.backgroundPosition = 'center';
        }
    }

    /**
     * Imposta placeholder per thumbnail
     * @param {HTMLElement} thumb
     * @param {Object} item
     */
    setThumbnailPlaceholder(thumb, item) {
        const loading = thumb.querySelector('.media-loading');
        if (loading) {
            loading.innerHTML = item?.isVideo() ? `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polygon points="23,7 16,12 23,17 23,7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
            ` : `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                </svg>
            `;
            loading.classList.remove('media-loading');
            loading.classList.add('media-placeholder');
        }
    }

    /**
     * Apre il lightbox per un item
     * @param {Object} item
     */
    openLightbox(item) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-backdrop"></div>
            <div class="lightbox-content">
                <button class="lightbox-close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
                <div class="lightbox-media">
                    ${item.isVideo()
                        ? `<video controls autoplay><source src="" type="${item.mimeType}"></video>`
                        : `<img src="" alt="${item.name}">`
                    }
                </div>
                <div class="lightbox-info">
                    <div class="lightbox-name">${this.escapeHtml(item.name)}</div>
                    <div class="lightbox-meta">${formatFileSize(item.size)} · ${formatDate(item.updated)}</div>
                </div>
            </div>
        `;

        document.body.appendChild(lightbox);

        // Carica il media
        if (this.options.getThumbnailUrl) {
            this.options.getThumbnailUrl(item.id).then(url => {
                const media = lightbox.querySelector(item.isVideo() ? 'source' : 'img');
                if (media) {
                    media.src = url;
                    if (item.isVideo()) {
                        lightbox.querySelector('video').load();
                    }
                }
            });
        }

        // Chiudi su click backdrop
        lightbox.querySelector('.lightbox-backdrop').addEventListener('click', () => {
            this.closeLightbox(lightbox);
        });

        // Chiudi su click X
        lightbox.querySelector('.lightbox-close').addEventListener('click', () => {
            this.closeLightbox(lightbox);
        });

        // Chiudi su ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeLightbox(lightbox);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Animazione
        requestAnimationFrame(() => lightbox.classList.add('active'));
    }

    /**
     * Chiude il lightbox
     * @param {HTMLElement} lightbox
     */
    closeLightbox(lightbox) {
        lightbox.classList.remove('active');
        setTimeout(() => {
            if (lightbox.parentNode) {
                lightbox.parentNode.removeChild(lightbox);
            }
        }, 300);
    }

    /**
     * Rimuove un item dalla galleria
     * @param {string} itemId
     */
    removeItem(itemId) {
        this.items = this.items.filter(i => i.id !== itemId);
        this.render(this.items);
    }

    /**
     * Aggiunge un item alla galleria
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

export default MediaGallery;
