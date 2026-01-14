/**
 * Modello Note per Scripta Manent
 * Rappresenta una nota markdown
 */

import { generateUUID } from '../config.js';

/**
 * Classe che rappresenta una nota
 */
export class Note {
    /**
     * @param {Object} data - Dati della nota
     */
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.name = data.name || 'Nuova nota';
        this.type = 'note';
        this.mimeType = 'text/markdown';
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.hash = data.hash || null;
        this.size = data.size || 0;
        this.encrypted = data.encrypted || false;
        this.folder = data.folder || '/notes';
        this.tags = data.tags || [];
        this.versions = data.versions || 1;

        // Contenuto (non salvato nei metadati)
        this.content = data.content || '';

        // IDs Google Drive (runtime)
        this.folderId = data.folderId || null;
        this.contentFileId = data.contentFileId || null;
        this.metaFileId = data.metaFileId || null;
    }

    /**
     * Crea una nota dai metadati JSON
     * @param {Object} meta - Oggetto meta.json
     * @returns {Note}
     */
    static fromMeta(meta) {
        return new Note(meta);
    }

    /**
     * Esporta i metadati per salvare su Drive
     * @returns {Object}
     */
    toMeta() {
        return {
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
    }

    /**
     * Aggiorna i metadati dopo una modifica
     * @param {string} newContent - Il nuovo contenuto
     * @param {string} [hash] - Hash del contenuto
     */
    updateContent(newContent, hash = null) {
        this.content = newContent;
        this.size = new Blob([newContent]).size;
        this.updated = new Date().toISOString();
        this.hash = hash;
    }

    /**
     * Estrae il titolo dal contenuto markdown
     * @returns {string}
     */
    extractTitle() {
        if (!this.content) return this.name;

        // Cerca il primo heading
        const match = this.content.match(/^#\s+(.+)$/m);
        if (match) {
            return match[1].trim();
        }

        // Altrimenti usa la prima riga non vuota
        const firstLine = this.content.split('\n').find(line => line.trim());
        if (firstLine) {
            return firstLine.trim().substring(0, 100);
        }

        return this.name;
    }

    /**
     * Estrae un'anteprima del contenuto
     * @param {number} [maxLength=200] - Lunghezza massima
     * @returns {string}
     */
    getPreview(maxLength = 200) {
        if (!this.content) return '';

        // Rimuovi i headers
        let text = this.content.replace(/^#+\s+/gm, '');

        // Rimuovi formattazione markdown base
        text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
        text = text.replace(/\*([^*]+)\*/g, '$1');
        text = text.replace(/`([^`]+)`/g, '$1');
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        // Normalizza spazi
        text = text.replace(/\n+/g, ' ').trim();

        if (text.length > maxLength) {
            return text.substring(0, maxLength) + '...';
        }

        return text;
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
     * Verifica se la nota contiene un termine di ricerca
     * @param {string} query - Termine di ricerca
     * @returns {boolean}
     */
    matches(query) {
        const q = query.toLowerCase();
        return this.name.toLowerCase().includes(q) ||
            this.content.toLowerCase().includes(q) ||
            this.tags.some(tag => tag.includes(q));
    }

    /**
     * Conta le parole nella nota
     * @returns {number}
     */
    wordCount() {
        if (!this.content) return 0;
        return this.content.split(/\s+/).filter(w => w.length > 0).length;
    }

    /**
     * Conta i caratteri nella nota
     * @returns {number}
     */
    charCount() {
        return this.content ? this.content.length : 0;
    }

    /**
     * Clona la nota
     * @returns {Note}
     */
    clone() {
        return new Note({
            ...this.toMeta(),
            content: this.content,
            id: generateUUID(), // Nuovo ID
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        });
    }

    /**
     * Converte in oggetto serializzabile
     * @returns {Object}
     */
    toJSON() {
        return {
            ...this.toMeta(),
            content: this.content
        };
    }
}

export default Note;
