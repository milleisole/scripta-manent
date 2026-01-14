/**
 * Service per la gestione dei file e media
 * Gestisce upload, download, cifratura e organizzazione
 */

import { CONFIG, generateUUID, getItemType } from '../config.js';
import { FileItem } from '../models/file-item.js';
import { hashFile } from '../utils/hash.js';

/**
 * Service per le operazioni sui file
 */
export class FilesService {
    /**
     * @param {Object} storage - Provider di storage
     * @param {Object} keyManager - Gestore chiavi (opzionale)
     * @param {Object} searchService - Service di ricerca (opzionale)
     */
    constructor(storage, keyManager = null, searchService = null) {
        this.storage = storage;
        this.keyManager = keyManager;
        this.searchService = searchService;
        this.filesFolderId = null;
        this.mediaFolderId = null;
        this.cache = new Map();
    }

    /**
     * Inizializza il service
     */
    async initialize() {
        this.filesFolderId = await this.storage.getSystemFolderId(CONFIG.FOLDERS.FILES);
        this.mediaFolderId = await this.storage.getSystemFolderId(CONFIG.FOLDERS.MEDIA);
    }

    /**
     * Carica un file
     * @param {File} file - File object dal browser
     * @param {Object} [options] - Opzioni di upload
     * @returns {Promise<FileItem>}
     */
    async upload(file, options = {}) {
        const {
            encrypt = false,
            folder = null,
            tags = [],
            onProgress = null
        } = options;

        // Crea il FileItem
        const fileItem = FileItem.fromFile(file);
        fileItem.encrypted = encrypt;
        fileItem.tags = tags;

        // Determina la cartella di destinazione
        const parentFolderId = fileItem.type === 'media'
            ? this.mediaFolderId
            : this.filesFolderId;

        if (folder) {
            fileItem.folder = folder;
        }

        // Crea la cartella per questo file
        const itemFolderId = await this.storage.createFolder(fileItem.id, parentFolderId);
        fileItem.folderId = itemFolderId.id;

        // Prepara il contenuto
        let content = file;
        let filename = file.name;

        if (encrypt && this.keyManager?.isReady()) {
            const arrayBuffer = await file.arrayBuffer();
            content = await this.keyManager.encrypt(arrayBuffer);
            filename = file.name + '.enc';
            fileItem.mimeType = 'application/octet-stream';
        }

        // Calcola hash
        fileItem.hash = await hashFile(file);

        // Estrai metadati media se applicabile
        if (fileItem.isImage()) {
            await this.extractImageMetadata(file, fileItem);
        } else if (fileItem.isVideo()) {
            await this.extractVideoMetadata(file, fileItem);
        }

        // Upload del file
        if (onProgress) onProgress(0.3);

        const contentFile = await this.storage.createFile(
            filename,
            content,
            fileItem.mimeType,
            fileItem.folderId
        );
        fileItem.contentFileId = contentFile.id;

        if (onProgress) onProgress(0.8);

        // Salva i metadati
        const metaFile = await this.storage.createFile(
            'meta.json',
            JSON.stringify(fileItem.toMeta()),
            'application/json',
            fileItem.folderId
        );
        fileItem.metaFileId = metaFile.id;

        if (onProgress) onProgress(1);

        // Aggiorna cache
        this.cache.set(fileItem.id, fileItem);

        // Aggiorna indice di ricerca
        if (this.searchService) {
            await this.searchService.indexFile(fileItem);
        }

        return fileItem;
    }

    /**
     * Carica più file
     * @param {FileList|File[]} files
     * @param {Object} [options]
     * @param {Function} [onProgress] - Callback per progresso totale
     * @returns {Promise<FileItem[]>}
     */
    async uploadMultiple(files, options = {}, onProgress = null) {
        const results = [];
        const total = files.length;

        for (let i = 0; i < total; i++) {
            const file = files[i];
            const fileItem = await this.upload(file, {
                ...options,
                onProgress: (p) => {
                    if (onProgress) {
                        const overallProgress = (i + p) / total;
                        onProgress(overallProgress, file.name);
                    }
                }
            });
            results.push(fileItem);
        }

        return results;
    }

    /**
     * Ottiene un file per ID
     * @param {string} fileId
     * @returns {Promise<FileItem|null>}
     */
    async get(fileId) {
        if (this.cache.has(fileId)) {
            return this.cache.get(fileId);
        }

        try {
            // Prova prima nella cartella files, poi media
            let itemFolder = await this.storage.findFolder(fileId, this.filesFolderId);
            let parentType = 'file';

            if (!itemFolder) {
                itemFolder = await this.storage.findFolder(fileId, this.mediaFolderId);
                parentType = 'media';
            }

            if (!itemFolder) return null;

            // Leggi metadati
            const metaFile = await this.storage.findFile('meta.json', itemFolder.id);
            if (!metaFile) return null;

            const meta = await this.storage.readFileAsJSON(metaFile.id);
            const fileItem = FileItem.fromMeta(meta);
            fileItem.folderId = itemFolder.id;
            fileItem.metaFileId = metaFile.id;

            // Trova il file contenuto
            const files = await this.storage.listFolder(itemFolder.id);
            const contentFile = files.find(f =>
                f.name !== 'meta.json' && f.mimeType !== 'application/vnd.google-apps.folder'
            );

            if (contentFile) {
                fileItem.contentFileId = contentFile.id;
            }

            this.cache.set(fileItem.id, fileItem);
            return fileItem;
        } catch (error) {
            console.error('Errore caricamento file:', error);
            return null;
        }
    }

    /**
     * Scarica il contenuto di un file
     * @param {string} fileId
     * @returns {Promise<Blob|null>}
     */
    async download(fileId) {
        const fileItem = await this.get(fileId);
        if (!fileItem || !fileItem.contentFileId) return null;

        try {
            let blob = await this.storage.exportFile(fileItem.contentFileId);

            // Decifra se necessario
            if (fileItem.encrypted && this.keyManager?.isReady()) {
                const decrypted = await this.keyManager.decrypt(await blob.arrayBuffer());
                blob = new Blob([decrypted], { type: fileItem.mimeType });
            }

            return blob;
        } catch (error) {
            console.error('Errore download file:', error);
            return null;
        }
    }

    /**
     * Ottiene un URL per il file (per preview)
     * @param {string} fileId
     * @returns {Promise<string|null>}
     */
    async getPreviewUrl(fileId) {
        const blob = await this.download(fileId);
        if (!blob) return null;
        return URL.createObjectURL(blob);
    }

    /**
     * Elimina un file (sposta nel cestino)
     * @param {string} fileId
     * @param {Object} trashService
     * @returns {Promise<boolean>}
     */
    async delete(fileId, trashService = null) {
        const fileItem = await this.get(fileId);
        if (!fileItem) return false;

        try {
            if (trashService) {
                await trashService.moveToTrash(fileItem);
            } else {
                await this.storage.deleteFile(fileItem.folderId);
            }

            this.cache.delete(fileId);

            if (this.searchService) {
                await this.searchService.removeFromIndex(fileId);
            }

            return true;
        } catch (error) {
            console.error('Errore eliminazione file:', error);
            return false;
        }
    }

    /**
     * Lista i file
     * @param {Object} [options]
     * @returns {Promise<FileItem[]>}
     */
    async list(options = {}) {
        const {
            type = null, // 'file' o 'media'
            mimeType = null,
            tags = null,
            encrypted = null,
            sortBy = 'updated',
            sortOrder = 'desc',
            limit = null
        } = options;

        try {
            const files = [];

            // Lista dalla cartella files
            if (!type || type === 'file') {
                const fileFolders = await this.storage.listFolder(this.filesFolderId);
                for (const folder of fileFolders) {
                    if (folder.mimeType === 'application/vnd.google-apps.folder') {
                        const file = await this.get(folder.name);
                        if (file) files.push(file);
                    }
                }
            }

            // Lista dalla cartella media
            if (!type || type === 'media') {
                const mediaFolders = await this.storage.listFolder(this.mediaFolderId);
                for (const folder of mediaFolders) {
                    if (folder.mimeType === 'application/vnd.google-apps.folder') {
                        const file = await this.get(folder.name);
                        if (file) files.push(file);
                    }
                }
            }

            // Applica filtri
            let filtered = files;

            if (mimeType) {
                filtered = filtered.filter(f => f.mimeType.includes(mimeType));
            }

            if (tags && tags.length > 0) {
                filtered = filtered.filter(f =>
                    tags.some(t => f.tags.includes(t))
                );
            }

            if (encrypted !== null) {
                filtered = filtered.filter(f => f.encrypted === encrypted);
            }

            // Ordinamento
            filtered.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];
                const order = sortOrder === 'desc' ? -1 : 1;
                return aVal > bVal ? order : -order;
            });

            if (limit) {
                filtered = filtered.slice(0, limit);
            }

            return filtered;
        } catch (error) {
            console.error('Errore lista file:', error);
            return [];
        }
    }

    /**
     * Lista solo i media (immagini e video)
     * @param {Object} [options]
     * @returns {Promise<FileItem[]>}
     */
    async listMedia(options = {}) {
        return await this.list({ ...options, type: 'media' });
    }

    /**
     * Lista solo i file (non media)
     * @param {Object} [options]
     * @returns {Promise<FileItem[]>}
     */
    async listFiles(options = {}) {
        return await this.list({ ...options, type: 'file' });
    }

    /**
     * Rinomina un file
     * @param {string} fileId
     * @param {string} newName
     * @returns {Promise<FileItem|null>}
     */
    async rename(fileId, newName) {
        const fileItem = await this.get(fileId);
        if (!fileItem) return null;

        fileItem.name = newName;
        fileItem.updated = new Date().toISOString();

        await this.storage.updateFile(
            fileItem.metaFileId,
            JSON.stringify(fileItem.toMeta()),
            'application/json'
        );

        this.cache.set(fileItem.id, fileItem);

        if (this.searchService) {
            await this.searchService.indexFile(fileItem);
        }

        return fileItem;
    }

    /**
     * Aggiorna i tag di un file
     * @param {string} fileId
     * @param {string[]} tags
     * @returns {Promise<FileItem|null>}
     */
    async updateTags(fileId, tags) {
        const fileItem = await this.get(fileId);
        if (!fileItem) return null;

        fileItem.tags = tags.map(t => t.toLowerCase().trim());
        fileItem.updated = new Date().toISOString();

        await this.storage.updateFile(
            fileItem.metaFileId,
            JSON.stringify(fileItem.toMeta()),
            'application/json'
        );

        this.cache.set(fileItem.id, fileItem);

        if (this.searchService) {
            await this.searchService.indexFile(fileItem);
        }

        return fileItem;
    }

    /**
     * Estrae metadati da un'immagine
     * @param {File} file
     * @param {FileItem} fileItem
     */
    async extractImageMetadata(file, fileItem) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                fileItem.setImageDimensions(img.width, img.height);
                URL.revokeObjectURL(img.src);
                resolve();
            };
            img.onerror = () => resolve();
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Estrae metadati da un video
     * @param {File} file
     * @param {FileItem} fileItem
     */
    async extractVideoMetadata(file, fileItem) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                fileItem.setImageDimensions(video.videoWidth, video.videoHeight);
                fileItem.setDuration(video.duration);
                URL.revokeObjectURL(video.src);
                resolve();
            };
            video.onerror = () => resolve();
            video.src = URL.createObjectURL(file);
        });
    }

    /**
     * Ottiene statistiche sui file
     * @returns {Promise<Object>}
     */
    async getStats() {
        const files = await this.listFiles();
        const media = await this.listMedia();

        return {
            totalFiles: files.length,
            totalMedia: media.length,
            images: media.filter(m => m.isImage()).length,
            videos: media.filter(m => m.isVideo()).length,
            totalSize: [...files, ...media].reduce((sum, f) => sum + f.size, 0),
            encrypted: [...files, ...media].filter(f => f.encrypted).length
        };
    }

    /**
     * Pulisce la cache
     */
    clearCache() {
        this.cache.clear();
    }
}

export default FilesService;
