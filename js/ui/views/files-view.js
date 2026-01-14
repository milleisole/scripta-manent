/**
 * Files View per Scripta Manent
 * Lista e gestione file
 */

import { formatFileSize, formatDate } from '../../config.js';
import { FileList } from '../components/file-list.js';

/**
 * View dei file
 */
export class FilesView {
    constructor(app) {
        this.app = app;
        this.files = [];
        this.fileList = null;
    }

    /**
     * Renderizza la view
     */
    async render() {
        this.files = await this.loadFiles();

        return `
            <div class="view files-view">
                <div class="view-header">
                    <div>
                        <h1 class="view-title">File</h1>
                        <p class="view-subtitle">${this.files.length} file totali</p>
                    </div>
                    <button class="btn btn-primary" data-action="upload-file">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="17,8 12,3 7,8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Carica file
                    </button>
                </div>

                <div id="files-container"></div>
            </div>
        `;
    }

    /**
     * Carica i file
     */
    async loadFiles() {
        try {
            if (!this.app.filesService) return [];
            return await this.app.filesService.listFiles();
        } catch (error) {
            console.error('Errore caricamento file:', error);
            return [];
        }
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        const container = document.getElementById('files-container');
        if (!container) return;

        // Inizializza FileList component
        this.fileList = new FileList(container, {
            onItemClick: (item) => this.openFile(item),
            onItemAction: (action, item) => this.handleAction(action, item),
            emptyMessage: 'Nessun file'
        });

        this.fileList.render(this.files);

        // Upload button
        document.querySelectorAll('[data-action="upload-file"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.app.handleAction('upload-file');
            });
        });
    }

    /**
     * Apre un file
     */
    async openFile(item) {
        try {
            const url = await this.app.filesService.getPreviewUrl(item.id);
            if (url) {
                if (item.isPDF()) {
                    // Apri PDF in nuova tab
                    window.open(url, '_blank');
                } else {
                    // Mostra preview nel modal
                    this.showPreview(item, url);
                }
            }
        } catch (error) {
            this.app.toast.error('Impossibile aprire il file');
        }
    }

    /**
     * Mostra preview del file
     */
    showPreview(item, url) {
        const body = document.createElement('div');
        body.className = 'file-preview';

        if (item.isImage()) {
            body.innerHTML = `<img src="${url}" alt="${item.name}">`;
        } else if (item.isVideo()) {
            body.innerHTML = `<video src="${url}" controls autoplay></video>`;
        } else if (item.isAudio()) {
            body.innerHTML = `<audio src="${url}" controls autoplay></audio>`;
        } else {
            body.innerHTML = `<p>Anteprima non disponibile per questo tipo di file</p>`;
        }

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = 'var(--space-sm)';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-secondary';
        downloadBtn.textContent = 'Scarica';
        downloadBtn.onclick = () => this.downloadFile(item);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-primary';
        closeBtn.textContent = 'Chiudi';
        closeBtn.onclick = () => this.app.modal.close();

        footer.appendChild(downloadBtn);
        footer.appendChild(closeBtn);

        this.app.modal.open({
            title: item.name,
            body,
            footer,
            className: 'file-preview-modal'
        });
    }

    /**
     * Gestisce le azioni sui file
     */
    async handleAction(action, item) {
        switch (action) {
            case 'download':
                await this.downloadFile(item);
                break;
            case 'share':
                await this.shareFile(item);
                break;
            case 'delete':
                await this.deleteFile(item);
                break;
        }
    }

    /**
     * Scarica un file
     */
    async downloadFile(item) {
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
     * Condivide un file
     */
    async shareFile(item) {
        try {
            const result = await this.app.shareService.shareWithQR(item.contentFileId);
            this.app.modal.showQR('Condividi file', result.qrCode, result.url);
        } catch (error) {
            this.app.toast.error('Errore durante la condivisione');
        }
    }

    /**
     * Elimina un file
     */
    async deleteFile(item) {
        const confirmed = await this.app.modal.confirm(
            'Elimina file',
            `Sei sicuro di voler eliminare "${item.name}"?`,
            { danger: true }
        );

        if (confirmed) {
            try {
                await this.app.filesService.delete(item.id, this.app.trashService);
                this.files = this.files.filter(f => f.id !== item.id);
                this.fileList.render(this.files);
                this.app.toast.success('File eliminato');
            } catch (error) {
                this.app.toast.error('Errore durante l\'eliminazione');
            }
        }
    }

    /**
     * Refresh della view
     */
    async refresh() {
        this.files = await this.loadFiles();
        if (this.fileList) {
            this.fileList.render(this.files);
        }
    }
}

export default FilesView;
