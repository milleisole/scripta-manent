/**
 * Media View per Scripta Manent
 * Galleria immagini e video
 */

import { MediaGallery } from '../components/media-gallery.js';

/**
 * View dei media
 */
export class MediaView {
    constructor(app) {
        this.app = app;
        this.media = [];
        this.gallery = null;
    }

    /**
     * Renderizza la view
     */
    async render() {
        this.media = await this.loadMedia();

        return `
            <div class="view media-view">
                <div class="view-header">
                    <div>
                        <h1 class="view-title">Media</h1>
                        <p class="view-subtitle">${this.media.length} file multimediali</p>
                    </div>
                    <button class="btn btn-primary" data-action="upload-media">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21,15 16,10 5,21"/>
                        </svg>
                        Carica media
                    </button>
                </div>

                <div id="media-container"></div>
            </div>
        `;
    }

    /**
     * Carica i media
     */
    async loadMedia() {
        try {
            if (!this.app.filesService) return [];
            return await this.app.filesService.listMedia();
        } catch (error) {
            console.error('Errore caricamento media:', error);
            return [];
        }
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        const container = document.getElementById('media-container');
        if (!container) return;

        // Inizializza MediaGallery component
        this.gallery = new MediaGallery(container, {
            onItemClick: (item) => this.openMedia(item),
            onItemAction: (action, item) => this.handleAction(action, item),
            getThumbnailUrl: (id) => this.app.filesService.getPreviewUrl(id),
            emptyMessage: 'Nessun media'
        });

        this.gallery.render(this.media);

        // Upload button
        document.querySelectorAll('[data-action="upload-media"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.app.handleAction('upload-media');
            });
        });
    }

    /**
     * Apre un media
     */
    async openMedia(item) {
        try {
            const url = await this.app.filesService.getPreviewUrl(item.id);
            if (url) {
                this.showLightbox(item, url);
            }
        } catch (error) {
            this.app.toast.error('Impossibile aprire il media');
        }
    }

    /**
     * Mostra il lightbox
     */
    showLightbox(item, url) {
        const body = document.createElement('div');
        body.className = 'file-preview';

        if (item.isImage()) {
            body.innerHTML = `<img src="${url}" alt="${item.name}" style="max-width: 100%; max-height: 70vh;">`;
        } else if (item.isVideo()) {
            body.innerHTML = `<video src="${url}" controls autoplay style="max-width: 100%; max-height: 70vh;"></video>`;
        }

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = 'var(--space-sm)';
        footer.style.justifyContent = 'center';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-secondary';
        downloadBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Scarica
        `;
        downloadBtn.onclick = () => this.downloadMedia(item);

        const shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-secondary';
        shareBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Condividi
        `;
        shareBtn.onclick = () => {
            this.app.modal.close();
            this.shareMedia(item);
        };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-primary';
        closeBtn.textContent = 'Chiudi';
        closeBtn.onclick = () => this.app.modal.close();

        footer.appendChild(downloadBtn);
        footer.appendChild(shareBtn);
        footer.appendChild(closeBtn);

        this.app.modal.open({
            title: item.name,
            body,
            footer,
            className: 'file-preview-modal'
        });
    }

    /**
     * Gestisce le azioni
     */
    async handleAction(action, item) {
        switch (action) {
            case 'download':
                await this.downloadMedia(item);
                break;
            case 'share':
                await this.shareMedia(item);
                break;
            case 'delete':
                await this.deleteMedia(item);
                break;
        }
    }

    /**
     * Scarica un media
     */
    async downloadMedia(item) {
        try {
            const blob = await this.app.filesService.download(item.id);
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = item.name;
                a.click();
                URL.revokeObjectURL(url);
                this.app.toast.success('Download avviato');
            }
        } catch (error) {
            this.app.toast.error('Errore durante il download');
        }
    }

    /**
     * Condivide un media
     */
    async shareMedia(item) {
        try {
            const result = await this.app.shareService.shareWithQR(item.contentFileId);
            this.app.modal.showQR('Condividi media', result.qrCode, result.url);
        } catch (error) {
            this.app.toast.error('Errore durante la condivisione');
        }
    }

    /**
     * Elimina un media
     */
    async deleteMedia(item) {
        const confirmed = await this.app.modal.confirm(
            'Elimina media',
            `Sei sicuro di voler eliminare "${item.name}"?`,
            { danger: true }
        );

        if (confirmed) {
            try {
                await this.app.filesService.delete(item.id, this.app.trashService);
                this.media = this.media.filter(m => m.id !== item.id);
                this.gallery.render(this.media);
                this.app.toast.success('Media eliminato');
            } catch (error) {
                this.app.toast.error('Errore durante l\'eliminazione');
            }
        }
    }

    /**
     * Refresh della view
     */
    async refresh() {
        this.media = await this.loadMedia();
        if (this.gallery) {
            this.gallery.render(this.media);
        }
    }
}

export default MediaView;
