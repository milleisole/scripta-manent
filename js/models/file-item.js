/**
 * Modello FileItem per Scripta Manent
 * Rappresenta un file generico o media
 */

import { generateUUID, formatFileSize, getItemType } from '../config.js';

/**
 * Classe che rappresenta un file o media
 */
export class FileItem {
    /**
     * @param {Object} data - Dati del file
     */
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.name = data.name || 'Nuovo file';
        this.type = data.type || 'file'; // 'file' o 'media'
        this.mimeType = data.mimeType || 'application/octet-stream';
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.hash = data.hash || null;
        this.size = data.size || 0;
        this.encrypted = data.encrypted || false;
        this.folder = data.folder || '/files';
        this.tags = data.tags || [];
        this.versions = data.versions || 1;

        // Metadati aggiuntivi per media
        this.width = data.width || null;
        this.height = data.height || null;
        this.duration = data.duration || null;
        this.thumbnail = data.thumbnail || null;

        // IDs Google Drive (runtime)
        this.folderId = data.folderId || null;
        this.contentFileId = data.contentFileId || null;
        this.metaFileId = data.metaFileId || null;

        // Blob per upload (runtime, non persistito)
        this._blob = data.blob || null;
    }

    /**
     * Crea un FileItem da un File object nativo
     * @param {File} file - File object dal browser
     * @returns {FileItem}
     */
    static fromFile(file) {
        const type = getItemType(file.type);

        return new FileItem({
            name: file.name,
            type: type === 'media' ? 'media' : 'file',
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            folder: type === 'media' ? '/media' : '/files',
            blob: file
        });
    }

    /**
     * Crea un FileItem dai metadati JSON
     * @param {Object} meta - Oggetto meta.json
     * @returns {FileItem}
     */
    static fromMeta(meta) {
        return new FileItem(meta);
    }

    /**
     * Esporta i metadati per salvare su Drive
     * @returns {Object}
     */
    toMeta() {
        const meta = {
            id: this.id,
            name: this.name,
            type: this.type,
            mimeType: this.mimeType,
            created: this.created,
            updated: this.updated,
            hash: this.hash,
            size: this.size,
            encrypted: this.encrypted,
            folder: this.folder,
            tags: this.tags,
            versions: this.versions
        };

        // Aggiungi metadati media se presenti
        if (this.width) meta.width = this.width;
        if (this.height) meta.height = this.height;
        if (this.duration) meta.duration = this.duration;

        return meta;
    }

    /**
     * Verifica se è un'immagine
     * @returns {boolean}
     */
    isImage() {
        return this.mimeType.startsWith('image/');
    }

    /**
     * Verifica se è un video
     * @returns {boolean}
     */
    isVideo() {
        return this.mimeType.startsWith('video/');
    }

    /**
     * Verifica se è un audio
     * @returns {boolean}
     */
    isAudio() {
        return this.mimeType.startsWith('audio/');
    }

    /**
     * Verifica se è un PDF
     * @returns {boolean}
     */
    isPDF() {
        return this.mimeType === 'application/pdf';
    }

    /**
     * Verifica se è un documento Office
     * @returns {boolean}
     */
    isDocument() {
        const docTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];
        return docTypes.includes(this.mimeType);
    }

    /**
     * Verifica se ha una preview disponibile
     * @returns {boolean}
     */
    hasPreview() {
        return this.isImage() || this.isVideo() || this.isPDF();
    }

    /**
     * Ottiene l'estensione del file
     * @returns {string}
     */
    getExtension() {
        const parts = this.name.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    /**
     * Ottiene la dimensione formattata
     * @returns {string}
     */
    getFormattedSize() {
        return formatFileSize(this.size);
    }

    /**
     * Ottiene l'icona appropriata per il tipo di file
     * @returns {string} - Nome dell'icona
     */
    getIconName() {
        if (this.isImage()) return 'image';
        if (this.isVideo()) return 'video';
        if (this.isAudio()) return 'audio';
        if (this.isPDF()) return 'pdf';
        if (this.isDocument()) return 'document';

        const ext = this.getExtension();
        const extIcons = {
            'zip': 'archive',
            'rar': 'archive',
            '7z': 'archive',
            'tar': 'archive',
            'gz': 'archive',
            'txt': 'text',
            'md': 'markdown',
            'json': 'code',
            'xml': 'code',
            'html': 'code',
            'css': 'code',
            'js': 'code'
        };

        return extIcons[ext] || 'file';
    }

    /**
     * Aggiunge un tag
     * @param {string} tag
     */
    addTag(tag) {
        const normalizedTag = tag.toLowerCase().trim();
        if (!this.tags.includes(normalizedTag)) {
            this.tags.push(normalizedTag);
            this.updated = new Date().toISOString();
        }
    }

    /**
     * Rimuove un tag
     * @param {string} tag
     */
    removeTag(tag) {
        const normalizedTag = tag.toLowerCase().trim();
        const index = this.tags.indexOf(normalizedTag);
        if (index > -1) {
            this.tags.splice(index, 1);
            this.updated = new Date().toISOString();
        }
    }

    /**
     * Verifica se il file corrisponde a un termine di ricerca
     * @param {string} query - Termine di ricerca
     * @returns {boolean}
     */
    matches(query) {
        const q = query.toLowerCase();
        return this.name.toLowerCase().includes(q) ||
            this.tags.some(tag => tag.includes(q)) ||
            this.mimeType.toLowerCase().includes(q);
    }

    /**
     * Imposta i metadati di un'immagine
     * @param {number} width
     * @param {number} height
     */
    setImageDimensions(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Imposta la durata di un video/audio
     * @param {number} seconds
     */
    setDuration(seconds) {
        this.duration = seconds;
    }

    /**
     * Ottiene la durata formattata (per video/audio)
     * @returns {string|null}
     */
    getFormattedDuration() {
        if (!this.duration) return null;

        const mins = Math.floor(this.duration / 60);
        const secs = Math.floor(this.duration % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Ottiene il blob del file (se disponibile)
     * @returns {Blob|null}
     */
    getBlob() {
        return this._blob;
    }

    /**
     * Imposta il blob del file
     * @param {Blob} blob
     */
    setBlob(blob) {
        this._blob = blob;
    }

    /**
     * Clona il file item
     * @returns {FileItem}
     */
    clone() {
        const cloned = new FileItem({
            ...this.toMeta(),
            id: generateUUID(),
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        });
        cloned._blob = this._blob;
        return cloned;
    }

    /**
     * Converte in oggetto serializzabile
     * @returns {Object}
     */
    toJSON() {
        return this.toMeta();
    }
}

export default FileItem;
