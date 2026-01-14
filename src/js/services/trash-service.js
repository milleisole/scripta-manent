/**
 * Service per la gestione del cestino
 * Gestisce versioning, retention e restore
 */

import { CONFIG } from '../config.js';

/**
 * Service per le operazioni sul cestino
 */
export class TrashService {
    /**
     * @param {Object} storage - Provider di storage
     */
    constructor(storage) {
        this.storage = storage;
        this.trashFolderId = null;
    }

    /**
     * Inizializza il service
     */
    async initialize() {
        this.trashFolderId = await this.storage.getSystemFolderId(CONFIG.FOLDERS.TRASH);
    }

    /**
     * Sposta un item nel cestino
     * @param {Object} item - Note o FileItem da spostare
     * @returns {Promise<boolean>}
     */
    async moveToTrash(item) {
        try {
            // Crea cartella per questo item nel cestino
            const itemTrashFolder = await this.storage.getOrCreateFolder(item.id, this.trashFolderId);

            // Timestamp per il nome
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const originalName = item.name || 'unknown';
            const backupName = `${timestamp}_${originalName}`;

            // Copia il file contenuto nel cestino
            if (item.contentFileId) {
                await this.storage.copyFile(item.contentFileId, backupName, itemTrashFolder);
            }

            // Copia anche i metadati
            if (item.metaFileId) {
                await this.storage.copyFile(
                    item.metaFileId,
                    `${timestamp}_meta.json`,
                    itemTrashFolder
                );
            }

            // Elimina i file originali
            if (item.folderId) {
                await this.storage.deleteFile(item.folderId);
            }

            // Applica le regole di versioning
            await this.enforceVersionLimits(item.id, item.size || 0);

            return true;
        } catch (error) {
            console.error('Errore spostamento nel cestino:', error);
            return false;
        }
    }

    /**
     * Applica i limiti di versioni per un item
     * @param {string} itemId
     * @param {number} fileSize
     */
    async enforceVersionLimits(itemId, fileSize) {
        try {
            const itemFolder = await this.storage.findFolder(itemId, this.trashFolderId);
            if (!itemFolder) return;

            const files = await this.storage.listFolder(itemFolder.id);

            // Filtra solo i file di contenuto (escludi meta.json)
            const contentFiles = files.filter(f =>
                !f.name.endsWith('_meta.json') &&
                f.mimeType !== 'application/vnd.google-apps.folder'
            );

            // Determina il limite di versioni
            const maxVersions = fileSize >= CONFIG.DEFAULT_SETTINGS.largeFileSizeThreshold
                ? CONFIG.DEFAULT_SETTINGS.maxVersionsLargeFile
                : CONFIG.DEFAULT_SETTINGS.maxVersionsSmallFile;

            // Se ci sono troppe versioni, elimina le più vecchie
            if (contentFiles.length > maxVersions) {
                // Ordina per data (dal timestamp nel nome)
                contentFiles.sort((a, b) => {
                    const timestampA = this.extractTimestamp(a.name);
                    const timestampB = this.extractTimestamp(b.name);
                    return timestampA - timestampB;
                });

                // Elimina le versioni più vecchie
                const toDelete = contentFiles.slice(0, contentFiles.length - maxVersions);
                for (const file of toDelete) {
                    await this.storage.deleteFile(file.id);

                    // Elimina anche il meta associato se esiste
                    const metaName = file.name.replace(/^(\d{4}-\d{2}-\d{2}T[\d-]+)_(.+)$/, '$1_meta.json');
                    const metaFile = files.find(f => f.name === metaName);
                    if (metaFile) {
                        await this.storage.deleteFile(metaFile.id);
                    }
                }
            }
        } catch (error) {
            console.error('Errore applicazione limiti versioni:', error);
        }
    }

    /**
     * Estrae il timestamp dal nome del file
     * @param {string} filename
     * @returns {Date}
     */
    extractTimestamp(filename) {
        const match = filename.match(/^(\d{4}-\d{2}-\d{2}T[\d-]+)/);
        if (match) {
            const isoString = match[1].replace(/-(\d{2})-(\d{2})-(\d{3})$/, ':$1:$2.$3');
            return new Date(isoString);
        }
        return new Date(0);
    }

    /**
     * Lista tutti gli item nel cestino
     * @returns {Promise<Array>}
     */
    async list() {
        try {
            const itemFolders = await this.storage.listFolder(this.trashFolderId);
            const results = [];

            for (const folder of itemFolders) {
                if (folder.mimeType !== 'application/vnd.google-apps.folder') continue;

                const versions = await this.getItemVersions(folder.id);
                if (versions.length > 0) {
                    results.push({
                        id: folder.name,
                        folderId: folder.id,
                        versions: versions
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Errore lista cestino:', error);
            return [];
        }
    }

    /**
     * Ottiene le versioni di un item nel cestino
     * @param {string} folderId
     * @returns {Promise<Array>}
     */
    async getItemVersions(folderId) {
        try {
            const files = await this.storage.listFolder(folderId);
            const versions = [];

            for (const file of files) {
                if (file.name.endsWith('_meta.json')) continue;
                if (file.mimeType === 'application/vnd.google-apps.folder') continue;

                const timestamp = this.extractTimestamp(file.name);
                const originalName = file.name.replace(/^[\d-T]+_/, '');

                // Cerca il meta file associato
                const metaName = file.name.replace(/^(\d{4}-\d{2}-\d{2}T[\d-]+)_.+$/, '$1_meta.json');
                const metaFile = files.find(f => f.name === metaName);
                let meta = null;

                if (metaFile) {
                    try {
                        meta = await this.storage.readFileAsJSON(metaFile.id);
                    } catch (e) {
                        // Ignora errori di parsing meta
                    }
                }

                versions.push({
                    fileId: file.id,
                    name: originalName,
                    timestamp: timestamp,
                    size: file.size,
                    meta: meta
                });
            }

            // Ordina per timestamp decrescente (più recenti prima)
            versions.sort((a, b) => b.timestamp - a.timestamp);

            return versions;
        } catch (error) {
            console.error('Errore lettura versioni:', error);
            return [];
        }
    }

    /**
     * Ripristina un item dal cestino
     * @param {string} itemId - ID dell'item
     * @param {string} versionFileId - ID del file versione da ripristinare
     * @param {string} destinationFolderId - ID cartella destinazione
     * @returns {Promise<Object|null>}
     */
    async restore(itemId, versionFileId, destinationFolderId) {
        try {
            // Crea una nuova cartella per l'item
            const itemFolder = await this.storage.createFolder(itemId, destinationFolderId);

            // Ottieni info sul file da ripristinare
            const fileMetadata = await this.storage.getFileMetadata(versionFileId);
            const originalName = fileMetadata.name.replace(/^[\d-T]+_/, '');

            // Copia il file nella nuova cartella
            const restoredFile = await this.storage.copyFile(
                versionFileId,
                originalName,
                itemFolder.id
            );

            // Cerca e ripristina i metadati
            const itemTrashFolder = await this.storage.findFolder(itemId, this.trashFolderId);
            if (itemTrashFolder) {
                const files = await this.storage.listFolder(itemTrashFolder.id);
                const metaTimestamp = fileMetadata.name.match(/^(\d{4}-\d{2}-\d{2}T[\d-]+)/)?.[1];
                const metaFile = files.find(f => f.name === `${metaTimestamp}_meta.json`);

                if (metaFile) {
                    const meta = await this.storage.readFileAsJSON(metaFile.id);
                    meta.id = itemId;
                    meta.updated = new Date().toISOString();

                    await this.storage.createFile(
                        'meta.json',
                        JSON.stringify(meta),
                        'application/json',
                        itemFolder.id
                    );

                    return {
                        ...meta,
                        folderId: itemFolder.id,
                        contentFileId: restoredFile.id
                    };
                }
            }

            return {
                id: itemId,
                name: originalName,
                folderId: itemFolder.id,
                contentFileId: restoredFile.id
            };
        } catch (error) {
            console.error('Errore ripristino dal cestino:', error);
            return null;
        }
    }

    /**
     * Elimina permanentemente un item dal cestino
     * @param {string} itemId
     * @returns {Promise<boolean>}
     */
    async deletePermanently(itemId) {
        try {
            const itemFolder = await this.storage.findFolder(itemId, this.trashFolderId);
            if (itemFolder) {
                await this.storage.deleteFile(itemFolder.id);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Errore eliminazione permanente:', error);
            return false;
        }
    }

    /**
     * Svuota completamente il cestino
     * @returns {Promise<number>} - Numero di item eliminati
     */
    async emptyTrash() {
        try {
            const items = await this.list();
            let deleted = 0;

            for (const item of items) {
                if (await this.deletePermanently(item.id)) {
                    deleted++;
                }
            }

            return deleted;
        } catch (error) {
            console.error('Errore svuotamento cestino:', error);
            return 0;
        }
    }

    /**
     * Pulisce gli item scaduti (più vecchi del retention period)
     * @returns {Promise<number>} - Numero di versioni eliminate
     */
    async cleanup() {
        try {
            const retentionMs = CONFIG.DEFAULT_SETTINGS.trashRetentionDays * 24 * 60 * 60 * 1000;
            const cutoffDate = new Date(Date.now() - retentionMs);
            let deleted = 0;

            const items = await this.list();

            for (const item of items) {
                const expiredVersions = item.versions.filter(v => v.timestamp < cutoffDate);

                for (const version of expiredVersions) {
                    try {
                        await this.storage.deleteFile(version.fileId);
                        deleted++;
                    } catch (e) {
                        console.warn('Errore eliminazione versione scaduta:', e);
                    }
                }

                // Se tutte le versioni sono state eliminate, elimina la cartella
                if (expiredVersions.length === item.versions.length) {
                    await this.deletePermanently(item.id);
                }
            }

            return deleted;
        } catch (error) {
            console.error('Errore cleanup cestino:', error);
            return 0;
        }
    }

    /**
     * Ottiene statistiche sul cestino
     * @returns {Promise<Object>}
     */
    async getStats() {
        try {
            const items = await this.list();
            let totalSize = 0;
            let totalVersions = 0;

            for (const item of items) {
                for (const version of item.versions) {
                    totalSize += version.size || 0;
                    totalVersions++;
                }
            }

            return {
                itemCount: items.length,
                versionCount: totalVersions,
                totalSize: totalSize
            };
        } catch (error) {
            console.error('Errore statistiche cestino:', error);
            return { itemCount: 0, versionCount: 0, totalSize: 0 };
        }
    }
}

export default TrashService;
