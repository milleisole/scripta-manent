/**
 * Modello Folder per Scripta Manent
 * Rappresenta una cartella virtuale
 */

import { generateUUID } from '../config.js';

/**
 * Classe che rappresenta una cartella
 */
export class Folder {
    /**
     * @param {Object} data - Dati della cartella
     */
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.name = data.name || 'Nuova cartella';
        this.path = data.path || '/';
        this.parent = data.parent || null;
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.color = data.color || null;
        this.icon = data.icon || null;

        // ID Google Drive (runtime)
        this.driveId = data.driveId || null;

        // Contenuto (runtime)
        this.children = data.children || [];
        this.items = data.items || [];
    }

    /**
     * Crea una cartella dai dati JSON
     * @param {Object} data
     * @returns {Folder}
     */
    static fromJSON(data) {
        return new Folder(data);
    }

    /**
     * Esporta i dati della cartella
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            path: this.path,
            parent: this.parent,
            created: this.created,
            updated: this.updated,
            color: this.color,
            icon: this.icon
        };
    }

    /**
     * Ottiene il percorso completo
     * @returns {string}
     */
    getFullPath() {
        return this.path.endsWith('/')
            ? this.path + this.name
            : this.path + '/' + this.name;
    }

    /**
     * Verifica se è la cartella root
     * @returns {boolean}
     */
    isRoot() {
        return this.parent === null && this.path === '/';
    }

    /**
     * Verifica se è una cartella di sistema
     * @returns {boolean}
     */
    isSystem() {
        const systemFolders = ['/notes', '/files', '/media', '/.trash'];
        return systemFolders.includes(this.getFullPath());
    }

    /**
     * Aggiunge una sottocartella
     * @param {Folder} folder
     */
    addChild(folder) {
        folder.parent = this.id;
        folder.path = this.getFullPath();
        this.children.push(folder);
        this.updated = new Date().toISOString();
    }

    /**
     * Rimuove una sottocartella
     * @param {string} folderId
     * @returns {Folder|null}
     */
    removeChild(folderId) {
        const index = this.children.findIndex(f => f.id === folderId);
        if (index > -1) {
            const removed = this.children.splice(index, 1)[0];
            this.updated = new Date().toISOString();
            return removed;
        }
        return null;
    }

    /**
     * Trova una sottocartella per ID
     * @param {string} folderId
     * @returns {Folder|null}
     */
    findChild(folderId) {
        return this.children.find(f => f.id === folderId) || null;
    }

    /**
     * Trova una sottocartella per nome
     * @param {string} name
     * @returns {Folder|null}
     */
    findChildByName(name) {
        return this.children.find(f => f.name === name) || null;
    }

    /**
     * Aggiunge un item (nota o file) alla cartella
     * @param {Object} item
     */
    addItem(item) {
        item.folder = this.getFullPath();
        this.items.push(item);
        this.updated = new Date().toISOString();
    }

    /**
     * Rimuove un item dalla cartella
     * @param {string} itemId
     * @returns {Object|null}
     */
    removeItem(itemId) {
        const index = this.items.findIndex(i => i.id === itemId);
        if (index > -1) {
            const removed = this.items.splice(index, 1)[0];
            this.updated = new Date().toISOString();
            return removed;
        }
        return null;
    }

    /**
     * Conta gli elementi nella cartella (incluse sottocartelle)
     * @returns {number}
     */
    countItems() {
        return this.items.length;
    }

    /**
     * Conta tutti gli elementi ricorsivamente
     * @returns {number}
     */
    countAllItems() {
        let count = this.items.length;
        for (const child of this.children) {
            count += child.countAllItems();
        }
        return count;
    }

    /**
     * Verifica se la cartella è vuota
     * @returns {boolean}
     */
    isEmpty() {
        return this.children.length === 0 && this.items.length === 0;
    }

    /**
     * Ottiene tutti gli item ricorsivamente
     * @returns {Array}
     */
    getAllItems() {
        let items = [...this.items];
        for (const child of this.children) {
            items = items.concat(child.getAllItems());
        }
        return items;
    }

    /**
     * Rinomina la cartella
     * @param {string} newName
     */
    rename(newName) {
        this.name = newName;
        this.updated = new Date().toISOString();

        // Aggiorna i path degli item
        const newPath = this.getFullPath();
        for (const item of this.items) {
            item.folder = newPath;
        }

        // Aggiorna ricorsivamente le sottocartelle
        for (const child of this.children) {
            child.path = newPath;
            child.updateChildPaths();
        }
    }

    /**
     * Aggiorna i path delle sottocartelle ricorsivamente
     */
    updateChildPaths() {
        const myPath = this.getFullPath();
        for (const item of this.items) {
            item.folder = myPath;
        }
        for (const child of this.children) {
            child.path = myPath;
            child.updateChildPaths();
        }
    }

    /**
     * Verifica se la cartella corrisponde a una query di ricerca
     * @param {string} query
     * @returns {boolean}
     */
    matches(query) {
        const q = query.toLowerCase();
        return this.name.toLowerCase().includes(q) ||
            this.path.toLowerCase().includes(q);
    }

    /**
     * Clona la cartella (senza contenuto)
     * @returns {Folder}
     */
    clone() {
        return new Folder({
            ...this.toJSON(),
            id: generateUUID(),
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        });
    }

    /**
     * Ottiene la "breadcrumb" (percorso navigabile)
     * @returns {Array<{name: string, path: string}>}
     */
    getBreadcrumb() {
        const parts = this.getFullPath().split('/').filter(p => p);
        const breadcrumb = [{ name: 'Home', path: '/' }];

        let currentPath = '';
        for (const part of parts) {
            currentPath += '/' + part;
            breadcrumb.push({
                name: part,
                path: currentPath
            });
        }

        return breadcrumb;
    }
}

/**
 * Classe helper per gestire l'albero delle cartelle
 */
export class FolderTree {
    constructor() {
        this.root = new Folder({
            name: 'root',
            path: '/'
        });
        this.flatMap = new Map();
        this.flatMap.set(this.root.id, this.root);
    }

    /**
     * Aggiunge una cartella all'albero
     * @param {Folder} folder
     * @param {string} [parentId] - ID della cartella genitore
     */
    add(folder, parentId = null) {
        const parent = parentId ? this.flatMap.get(parentId) : this.root;
        if (parent) {
            parent.addChild(folder);
            this.flatMap.set(folder.id, folder);
        }
    }

    /**
     * Rimuove una cartella dall'albero
     * @param {string} folderId
     * @returns {Folder|null}
     */
    remove(folderId) {
        const folder = this.flatMap.get(folderId);
        if (!folder || folder.isRoot()) return null;

        const parent = this.flatMap.get(folder.parent);
        if (parent) {
            parent.removeChild(folderId);
        }

        // Rimuovi dalla flatMap ricorsivamente
        this.removeFromMapRecursive(folder);

        return folder;
    }

    /**
     * Rimuove ricorsivamente dalla mappa
     */
    removeFromMapRecursive(folder) {
        this.flatMap.delete(folder.id);
        for (const child of folder.children) {
            this.removeFromMapRecursive(child);
        }
    }

    /**
     * Trova una cartella per ID
     * @param {string} folderId
     * @returns {Folder|null}
     */
    findById(folderId) {
        return this.flatMap.get(folderId) || null;
    }

    /**
     * Trova una cartella per percorso
     * @param {string} path
     * @returns {Folder|null}
     */
    findByPath(path) {
        for (const folder of this.flatMap.values()) {
            if (folder.getFullPath() === path) {
                return folder;
            }
        }
        return null;
    }

    /**
     * Ottiene tutte le cartelle come array piatto
     * @returns {Folder[]}
     */
    toArray() {
        return Array.from(this.flatMap.values());
    }
}

export default Folder;
