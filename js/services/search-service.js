/**
 * Service per la ricerca full-text
 * Gestisce l'indice di ricerca e le query
 */

import { CONFIG } from '../config.js';
import { stripMarkdown, extractPreview } from '../utils/markdown.js';

/**
 * Service per le operazioni di ricerca
 */
export class SearchService {
    /**
     * @param {Object} storage - Provider di storage
     */
    constructor(storage) {
        this.storage = storage;
        this.index = null;
        this.indexFileId = null;
        this.isDirty = false;
    }

    /**
     * Inizializza il service caricando l'indice
     */
    async initialize() {
        await this.loadIndex();
    }

    /**
     * Carica l'indice da Google Drive
     */
    async loadIndex() {
        try {
            const rootId = this.storage.getRootFolderId();
            const indexFile = await this.storage.findFile(CONFIG.SEARCH_INDEX_FILE_NAME, rootId);

            if (indexFile) {
                this.indexFileId = indexFile.id;
                this.index = await this.storage.readFileAsJSON(indexFile.id);
            } else {
                // Crea un nuovo indice vuoto
                this.index = this.createEmptyIndex();
                await this.saveIndex();
            }
        } catch (error) {
            console.error('Errore caricamento indice:', error);
            this.index = this.createEmptyIndex();
        }
    }

    /**
     * Crea un indice vuoto
     * @returns {Object}
     */
    createEmptyIndex() {
        return {
            version: 1,
            lastUpdate: new Date().toISOString(),
            entries: []
        };
    }

    /**
     * Salva l'indice su Google Drive
     */
    async saveIndex() {
        if (!this.index) return;

        this.index.lastUpdate = new Date().toISOString();

        try {
            const rootId = this.storage.getRootFolderId();

            if (this.indexFileId) {
                await this.storage.updateFile(
                    this.indexFileId,
                    JSON.stringify(this.index),
                    'application/json'
                );
            } else {
                const file = await this.storage.createFile(
                    CONFIG.SEARCH_INDEX_FILE_NAME,
                    JSON.stringify(this.index),
                    'application/json',
                    rootId
                );
                this.indexFileId = file.id;
            }

            this.isDirty = false;
        } catch (error) {
            console.error('Errore salvataggio indice:', error);
        }
    }

    /**
     * Indicizza una nota
     * @param {Object} note - La nota da indicizzare
     */
    async indexNote(note) {
        if (!this.index) await this.loadIndex();

        // Rimuovi entry esistente
        this.removeEntry(note.id);

        // Crea nuova entry
        const entry = {
            id: note.id,
            type: 'note',
            name: note.name,
            folder: note.folder,
            tags: note.tags,
            encrypted: note.encrypted,
            updated: note.updated
        };

        // Indicizza contenuto solo se non cifrato
        if (!note.encrypted && note.content) {
            entry.content = this.truncateContent(stripMarkdown(note.content));
        }

        this.index.entries.push(entry);
        this.isDirty = true;

        // Salva con debounce
        this.scheduleSave();
    }

    /**
     * Indicizza un file
     * @param {Object} fileItem - Il file da indicizzare
     */
    async indexFile(fileItem) {
        if (!this.index) await this.loadIndex();

        // Rimuovi entry esistente
        this.removeEntry(fileItem.id);

        // Crea nuova entry
        const entry = {
            id: fileItem.id,
            type: fileItem.type,
            name: fileItem.name,
            folder: fileItem.folder,
            tags: fileItem.tags,
            encrypted: fileItem.encrypted,
            mimeType: fileItem.mimeType,
            updated: fileItem.updated
        };

        this.index.entries.push(entry);
        this.isDirty = true;

        this.scheduleSave();
    }

    /**
     * Rimuove un item dall'indice
     * @param {string} id
     */
    removeEntry(id) {
        if (!this.index) return;

        const index = this.index.entries.findIndex(e => e.id === id);
        if (index > -1) {
            this.index.entries.splice(index, 1);
            this.isDirty = true;
        }
    }

    /**
     * Rimuove un item dall'indice e salva
     * @param {string} id
     */
    async removeFromIndex(id) {
        this.removeEntry(id);
        await this.saveIndex();
    }

    /**
     * Tronca il contenuto per l'indice
     * @param {string} content
     * @returns {string}
     */
    truncateContent(content) {
        const words = content.split(/\s+/);
        const maxWords = CONFIG.DEFAULT_SETTINGS.searchIndexMaxWords;

        if (words.length <= maxWords) {
            return content;
        }

        return words.slice(0, maxWords).join(' ');
    }

    /**
     * Pianifica il salvataggio con debounce
     */
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.saveIndex();
        }, 2000);
    }

    /**
     * Cerca nell'indice
     * @param {string} query - Termine di ricerca
     * @param {Object} [options] - Opzioni di ricerca
     * @returns {Array}
     */
    search(query, options = {}) {
        if (!this.index || !query) return [];

        const {
            type = null, // 'note', 'file', 'media'
            tags = null,
            folder = null,
            encrypted = null,
            limit = 50
        } = options;

        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        if (terms.length === 0) return [];

        let results = this.index.entries.filter(entry => {
            // Applica filtri
            if (type && entry.type !== type) return false;
            if (folder && entry.folder !== folder) return false;
            if (encrypted !== null && entry.encrypted !== encrypted) return false;
            if (tags && tags.length > 0 && !tags.some(t => entry.tags?.includes(t))) return false;

            // Cerca i termini
            return this.matchesTerms(entry, terms);
        });

        // Calcola score di rilevanza
        results = results.map(entry => ({
            ...entry,
            score: this.calculateScore(entry, terms)
        }));

        // Ordina per rilevanza
        results.sort((a, b) => b.score - a.score);

        // Applica limite
        if (limit) {
            results = results.slice(0, limit);
        }

        return results;
    }

    /**
     * Verifica se un'entry corrisponde ai termini
     * @param {Object} entry
     * @param {string[]} terms
     * @returns {boolean}
     */
    matchesTerms(entry, terms) {
        const searchable = this.getSearchableText(entry);
        return terms.every(term => searchable.includes(term));
    }

    /**
     * Ottiene il testo ricercabile da un'entry
     * @param {Object} entry
     * @returns {string}
     */
    getSearchableText(entry) {
        const parts = [
            entry.name || '',
            entry.folder || '',
            entry.content || '',
            ...(entry.tags || [])
        ];

        return parts.join(' ').toLowerCase();
    }

    /**
     * Calcola lo score di rilevanza
     * @param {Object} entry
     * @param {string[]} terms
     * @returns {number}
     */
    calculateScore(entry, terms) {
        let score = 0;
        const name = (entry.name || '').toLowerCase();
        const tags = (entry.tags || []).map(t => t.toLowerCase());
        const content = (entry.content || '').toLowerCase();

        for (const term of terms) {
            // Match nel nome = peso alto
            if (name.includes(term)) {
                score += 10;
                if (name.startsWith(term)) score += 5;
            }

            // Match nei tag = peso medio-alto
            if (tags.some(t => t.includes(term))) {
                score += 7;
                if (tags.includes(term)) score += 3;
            }

            // Match nel contenuto = peso base
            if (content.includes(term)) {
                score += 3;
                // Bonus per occorrenze multiple
                const matches = (content.match(new RegExp(term, 'gi')) || []).length;
                score += Math.min(matches - 1, 5);
            }
        }

        // Bonus per item recenti
        if (entry.updated) {
            const daysSinceUpdate = (Date.now() - new Date(entry.updated).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 7) score += 2;
            if (daysSinceUpdate < 1) score += 3;
        }

        return score;
    }

    /**
     * Cerca solo note
     * @param {string} query
     * @returns {Array}
     */
    searchNotes(query) {
        return this.search(query, { type: 'note' });
    }

    /**
     * Cerca solo file
     * @param {string} query
     * @returns {Array}
     */
    searchFiles(query) {
        return this.search(query, { type: 'file' });
    }

    /**
     * Cerca solo media
     * @param {string} query
     * @returns {Array}
     */
    searchMedia(query) {
        return this.search(query, { type: 'media' });
    }

    /**
     * Ottiene suggerimenti per l'autocompletamento
     * @param {string} prefix
     * @param {number} [limit=5]
     * @returns {string[]}
     */
    getSuggestions(prefix, limit = 5) {
        if (!this.index || !prefix) return [];

        const prefixLower = prefix.toLowerCase();
        const suggestions = new Set();

        for (const entry of this.index.entries) {
            // Suggerisci nomi
            if (entry.name?.toLowerCase().includes(prefixLower)) {
                suggestions.add(entry.name);
            }

            // Suggerisci tag
            for (const tag of (entry.tags || [])) {
                if (tag.toLowerCase().includes(prefixLower)) {
                    suggestions.add(`#${tag}`);
                }
            }

            if (suggestions.size >= limit * 2) break;
        }

        return Array.from(suggestions)
            .sort((a, b) => {
                const aStarts = a.toLowerCase().startsWith(prefixLower);
                const bStarts = b.toLowerCase().startsWith(prefixLower);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return a.length - b.length;
            })
            .slice(0, limit);
    }

    /**
     * Ottiene tutti i tag usati
     * @returns {Array<{tag: string, count: number}>}
     */
    getAllTags() {
        if (!this.index) return [];

        const tagCounts = new Map();

        for (const entry of this.index.entries) {
            for (const tag of (entry.tags || [])) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
        }

        return Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Rebuild dell'indice da zero
     * @param {Object} notesService
     * @param {Object} filesService
     */
    async rebuildIndex(notesService, filesService) {
        this.index = this.createEmptyIndex();

        // Indicizza tutte le note
        if (notesService) {
            const notes = await notesService.list();
            for (const note of notes) {
                await this.indexNote(note);
            }
        }

        // Indicizza tutti i file
        if (filesService) {
            const files = await filesService.list();
            for (const file of files) {
                await this.indexFile(file);
            }
        }

        await this.saveIndex();
    }

    /**
     * Ottiene statistiche sull'indice
     * @returns {Object}
     */
    getStats() {
        if (!this.index) {
            return { total: 0, notes: 0, files: 0, media: 0 };
        }

        return {
            total: this.index.entries.length,
            notes: this.index.entries.filter(e => e.type === 'note').length,
            files: this.index.entries.filter(e => e.type === 'file').length,
            media: this.index.entries.filter(e => e.type === 'media').length,
            lastUpdate: this.index.lastUpdate
        };
    }
}

export default SearchService;
