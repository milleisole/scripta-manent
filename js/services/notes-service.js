/**
 * Service per la gestione delle note
 * Gestisce CRUD, cifratura e sincronizzazione
 */

import { CONFIG, generateUUID } from '../config.js';
import { Note } from '../models/note.js';
import { hashFile } from '../utils/hash.js';

/**
 * Service per le operazioni sulle note
 */
export class NotesService {
    /**
     * @param {Object} storage - Provider di storage
     * @param {Object} keyManager - Gestore chiavi (opzionale)
     * @param {Object} searchService - Service di ricerca (opzionale)
     */
    constructor(storage, keyManager = null, searchService = null) {
        this.storage = storage;
        this.keyManager = keyManager;
        this.searchService = searchService;
        this.notesFolderId = null;
        this.cache = new Map();
    }

    /**
     * Inizializza il service
     */
    async initialize() {
        this.notesFolderId = await this.storage.getSystemFolderId(CONFIG.FOLDERS.NOTES);
    }

    /**
     * Crea una nuova nota
     * @param {Object} data - Dati della nota
     * @param {boolean} [encrypt=false] - Se cifrare la nota
     * @returns {Promise<Note>}
     */
    async create(data = {}, encrypt = false) {
        const note = new Note(data);
        note.encrypted = encrypt;

        // Crea la cartella per questa nota
        const noteFolderId = await this.storage.createFolder(note.id, this.notesFolderId);
        note.folderId = noteFolderId.id;

        // Prepara il contenuto
        let content = note.content || '';
        let filename = 'content.md';

        if (encrypt && this.keyManager?.isReady()) {
            const encrypted = await this.keyManager.encrypt(content);
            content = encrypted;
            filename = 'content.enc';
        }

        // Calcola hash
        const contentBlob = new Blob([content]);
        note.hash = await hashFile(contentBlob);
        note.size = contentBlob.size;

        // Salva il contenuto
        const contentFile = await this.storage.createFile(
            filename,
            content,
            note.encrypted ? 'application/octet-stream' : 'text/markdown',
            note.folderId
        );
        note.contentFileId = contentFile.id;

        // Salva i metadati
        const metaFile = await this.storage.createFile(
            'meta.json',
            JSON.stringify(note.toMeta()),
            'application/json',
            note.folderId
        );
        note.metaFileId = metaFile.id;

        // Aggiorna cache
        this.cache.set(note.id, note);

        // Aggiorna indice di ricerca
        if (this.searchService) {
            await this.searchService.indexNote(note);
        }

        return note;
    }

    /**
     * Ottiene una nota per ID
     * @param {string} noteId
     * @returns {Promise<Note|null>}
     */
    async get(noteId) {
        // Controlla cache
        if (this.cache.has(noteId)) {
            return this.cache.get(noteId);
        }

        try {
            // Trova la cartella della nota
            const noteFolder = await this.storage.findFolder(noteId, this.notesFolderId);
            if (!noteFolder) return null;

            // Leggi i metadati
            const metaFile = await this.storage.findFile('meta.json', noteFolder.id);
            if (!metaFile) return null;

            const meta = await this.storage.readFileAsJSON(metaFile.id);
            const note = Note.fromMeta(meta);
            note.folderId = noteFolder.id;
            note.metaFileId = metaFile.id;

            // Leggi il contenuto
            const contentFilename = note.encrypted ? 'content.enc' : 'content.md';
            const contentFile = await this.storage.findFile(contentFilename, noteFolder.id);

            if (contentFile) {
                note.contentFileId = contentFile.id;
                let content = await this.storage.readFile(contentFile.id);

                // Decifra se necessario
                if (note.encrypted && this.keyManager?.isReady()) {
                    content = await this.keyManager.decrypt(content);
                    const decoder = new TextDecoder();
                    note.content = decoder.decode(content);
                } else if (!note.encrypted) {
                    const decoder = new TextDecoder();
                    note.content = decoder.decode(content);
                }
            }

            // Aggiorna cache
            this.cache.set(note.id, note);

            return note;
        } catch (error) {
            console.error('Errore caricamento nota:', error);
            return null;
        }
    }

    /**
     * Aggiorna una nota esistente
     * @param {Note} note - La nota da aggiornare
     * @param {boolean} [createVersion=true] - Se creare una versione di backup
     * @returns {Promise<Note>}
     */
    async update(note, createVersion = true) {
        // Crea versione di backup se richiesto
        if (createVersion && note.contentFileId) {
            await this.createBackup(note);
        }

        // Prepara il contenuto
        let content = note.content || '';
        const filename = note.encrypted ? 'content.enc' : 'content.md';

        if (note.encrypted && this.keyManager?.isReady()) {
            const encrypted = await this.keyManager.encrypt(content);
            content = encrypted;
        }

        // Calcola hash e size
        const contentBlob = new Blob([content]);
        note.hash = await hashFile(contentBlob);
        note.size = contentBlob.size;
        note.updated = new Date().toISOString();
        note.versions += 1;

        // Aggiorna o crea il file contenuto
        if (note.contentFileId) {
            await this.storage.updateFile(
                note.contentFileId,
                content,
                note.encrypted ? 'application/octet-stream' : 'text/markdown'
            );
        } else {
            const contentFile = await this.storage.createFile(
                filename,
                content,
                note.encrypted ? 'application/octet-stream' : 'text/markdown',
                note.folderId
            );
            note.contentFileId = contentFile.id;
        }

        // Aggiorna metadati
        await this.storage.updateFile(
            note.metaFileId,
            JSON.stringify(note.toMeta()),
            'application/json'
        );

        // Aggiorna cache
        this.cache.set(note.id, note);

        // Aggiorna indice di ricerca
        if (this.searchService) {
            await this.searchService.indexNote(note);
        }

        return note;
    }

    /**
     * Elimina una nota (sposta nel cestino)
     * @param {string} noteId
     * @param {Object} trashService - Service del cestino
     * @returns {Promise<boolean>}
     */
    async delete(noteId, trashService = null) {
        const note = await this.get(noteId);
        if (!note) return false;

        try {
            if (trashService) {
                // Sposta nel cestino
                await trashService.moveToTrash(note);
            } else {
                // Elimina permanentemente
                await this.storage.deleteFile(note.folderId);
            }

            // Rimuovi dalla cache
            this.cache.delete(noteId);

            // Rimuovi dall'indice di ricerca
            if (this.searchService) {
                await this.searchService.removeFromIndex(noteId);
            }

            return true;
        } catch (error) {
            console.error('Errore eliminazione nota:', error);
            return false;
        }
    }

    /**
     * Lista tutte le note
     * @param {Object} [options] - Opzioni di filtro
     * @returns {Promise<Note[]>}
     */
    async list(options = {}) {
        const {
            folder = null,
            tags = null,
            encrypted = null,
            sortBy = 'updated',
            sortOrder = 'desc',
            limit = null
        } = options;

        try {
            const folders = await this.storage.listFolder(this.notesFolderId);
            const notes = [];

            for (const folder of folders) {
                if (folder.mimeType === 'application/vnd.google-apps.folder') {
                    const note = await this.get(folder.name);
                    if (note) {
                        notes.push(note);
                    }
                }
            }

            // Applica filtri
            let filtered = notes;

            if (folder) {
                filtered = filtered.filter(n => n.folder === folder);
            }

            if (tags && tags.length > 0) {
                filtered = filtered.filter(n =>
                    tags.some(t => n.tags.includes(t))
                );
            }

            if (encrypted !== null) {
                filtered = filtered.filter(n => n.encrypted === encrypted);
            }

            // Ordinamento
            filtered.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];
                const order = sortOrder === 'desc' ? -1 : 1;
                return aVal > bVal ? order : -order;
            });

            // Limite
            if (limit) {
                filtered = filtered.slice(0, limit);
            }

            return filtered;
        } catch (error) {
            console.error('Errore lista note:', error);
            return [];
        }
    }

    /**
     * Cerca note
     * @param {string} query - Termine di ricerca
     * @returns {Promise<Note[]>}
     */
    async search(query) {
        if (this.searchService) {
            return await this.searchService.searchNotes(query);
        }

        // Fallback: ricerca in cache
        const results = [];
        for (const note of this.cache.values()) {
            if (note.matches(query)) {
                results.push(note);
            }
        }
        return results;
    }

    /**
     * Crea un backup della nota corrente
     * @param {Note} note
     */
    async createBackup(note) {
        try {
            const trashFolderId = await this.storage.getSystemFolderId(CONFIG.FOLDERS.TRASH);
            const noteTrashedFolderId = await this.storage.getOrCreateFolder(note.id, trashFolderId);

            // Nome file con timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = note.encrypted
                ? `${timestamp}_content.enc`
                : `${timestamp}_content.md`;

            // Copia il contenuto attuale
            if (note.contentFileId) {
                await this.storage.copyFile(
                    note.contentFileId,
                    filename,
                    noteTrashedFolderId
                );
            }
        } catch (error) {
            console.error('Errore creazione backup:', error);
        }
    }

    /**
     * Cambia lo stato di cifratura di una nota
     * @param {string} noteId
     * @param {boolean} encrypt - Se cifrare o decifrare
     * @returns {Promise<Note|null>}
     */
    async toggleEncryption(noteId, encrypt) {
        if (!this.keyManager?.isReady()) {
            throw new Error('KeyManager non disponibile');
        }

        const note = await this.get(noteId);
        if (!note) return null;

        // Se già nello stato desiderato, non fare nulla
        if (note.encrypted === encrypt) {
            return note;
        }

        note.encrypted = encrypt;

        // Aggiorna il file
        return await this.update(note, true);
    }

    /**
     * Esporta una nota come file
     * @param {string} noteId
     * @param {string} [format='md'] - Formato di export ('md', 'txt', 'html')
     * @returns {Promise<Blob|null>}
     */
    async export(noteId, format = 'md') {
        const note = await this.get(noteId);
        if (!note) return null;

        let content = note.content;
        let mimeType = 'text/markdown';

        if (format === 'html') {
            // Import dinamico per evitare dipendenze circolari
            const { parseMarkdown } = await import('../utils/markdown.js');
            content = `<!DOCTYPE html>
<html>
<head><title>${note.name}</title></head>
<body>${parseMarkdown(note.content)}</body>
</html>`;
            mimeType = 'text/html';
        } else if (format === 'txt') {
            const { stripMarkdown } = await import('../utils/markdown.js');
            content = stripMarkdown(note.content);
            mimeType = 'text/plain';
        }

        return new Blob([content], { type: mimeType });
    }

    /**
     * Importa una nota da file
     * @param {File} file
     * @returns {Promise<Note>}
     */
    async import(file) {
        const content = await file.text();

        // Estrai titolo dal contenuto o usa il nome file
        let name = file.name.replace(/\.(md|txt|markdown)$/i, '');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
            name = titleMatch[1].trim();
        }

        return await this.create({
            name,
            content
        });
    }

    /**
     * Ottiene le statistiche delle note
     * @returns {Promise<Object>}
     */
    async getStats() {
        const notes = await this.list();

        return {
            total: notes.length,
            encrypted: notes.filter(n => n.encrypted).length,
            totalSize: notes.reduce((sum, n) => sum + n.size, 0),
            totalWords: notes.reduce((sum, n) => sum + n.wordCount(), 0),
            recentlyUpdated: notes.filter(n => {
                const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
                return new Date(n.updated).getTime() > dayAgo;
            }).length
        };
    }

    /**
     * Pulisce la cache
     */
    clearCache() {
        this.cache.clear();
    }
}

export default NotesService;
