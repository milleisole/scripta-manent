/**
 * Interfaccia astratta per i provider di storage
 * Definisce i metodi che ogni implementazione deve fornire
 */

/**
 * Classe base astratta per i provider di storage
 * @abstract
 */
export class StorageInterface {
    /**
     * @param {string} name - Nome del provider
     */
    constructor(name) {
        if (this.constructor === StorageInterface) {
            throw new Error('StorageInterface è una classe astratta e non può essere istanziata direttamente');
        }
        this.name = name;
        this.isAuthenticated = false;
        this.user = null;
    }

    // ==========================================
    // Autenticazione
    // ==========================================

    /**
     * Inizializza il provider di storage
     * @abstract
     * @returns {Promise<boolean>} - true se l'inizializzazione ha successo
     */
    async initialize() {
        throw new Error('Metodo initialize() non implementato');
    }

    /**
     * Esegue il login dell'utente
     * @abstract
     * @returns {Promise<Object>} - Dati dell'utente autenticato
     */
    async login() {
        throw new Error('Metodo login() non implementato');
    }

    /**
     * Esegue il logout dell'utente
     * @abstract
     * @returns {Promise<void>}
     */
    async logout() {
        throw new Error('Metodo logout() non implementato');
    }

    /**
     * Verifica se l'utente è autenticato
     * @abstract
     * @returns {Promise<boolean>}
     */
    async checkAuth() {
        throw new Error('Metodo checkAuth() non implementato');
    }

    /**
     * Ottiene i dati dell'utente corrente
     * @abstract
     * @returns {Promise<Object|null>}
     */
    async getCurrentUser() {
        throw new Error('Metodo getCurrentUser() non implementato');
    }

    // ==========================================
    // Gestione cartelle
    // ==========================================

    /**
     * Crea una cartella
     * @abstract
     * @param {string} name - Nome della cartella
     * @param {string} [parentId] - ID della cartella genitore
     * @returns {Promise<Object>} - Metadati della cartella creata
     */
    async createFolder(name, parentId) {
        throw new Error('Metodo createFolder() non implementato');
    }

    /**
     * Cerca una cartella per nome
     * @abstract
     * @param {string} name - Nome della cartella
     * @param {string} [parentId] - ID della cartella genitore
     * @returns {Promise<Object|null>} - Metadati della cartella o null
     */
    async findFolder(name, parentId) {
        throw new Error('Metodo findFolder() non implementato');
    }

    /**
     * Ottiene o crea una cartella
     * @abstract
     * @param {string} name - Nome della cartella
     * @param {string} [parentId] - ID della cartella genitore
     * @returns {Promise<Object>} - Metadati della cartella
     */
    async getOrCreateFolder(name, parentId) {
        throw new Error('Metodo getOrCreateFolder() non implementato');
    }

    /**
     * Lista il contenuto di una cartella
     * @abstract
     * @param {string} folderId - ID della cartella
     * @returns {Promise<Array>} - Lista dei file/cartelle
     */
    async listFolder(folderId) {
        throw new Error('Metodo listFolder() non implementato');
    }

    // ==========================================
    // Gestione file
    // ==========================================

    /**
     * Crea un nuovo file
     * @abstract
     * @param {string} name - Nome del file
     * @param {string|Blob|ArrayBuffer} content - Contenuto del file
     * @param {string} mimeType - MIME type del file
     * @param {string} [parentId] - ID della cartella genitore
     * @returns {Promise<Object>} - Metadati del file creato
     */
    async createFile(name, content, mimeType, parentId) {
        throw new Error('Metodo createFile() non implementato');
    }

    /**
     * Legge il contenuto di un file
     * @abstract
     * @param {string} fileId - ID del file
     * @returns {Promise<string|ArrayBuffer>} - Contenuto del file
     */
    async readFile(fileId) {
        throw new Error('Metodo readFile() non implementato');
    }

    /**
     * Legge il contenuto di un file come testo
     * @abstract
     * @param {string} fileId - ID del file
     * @returns {Promise<string>} - Contenuto testuale
     */
    async readFileAsText(fileId) {
        throw new Error('Metodo readFileAsText() non implementato');
    }

    /**
     * Legge il contenuto di un file come JSON
     * @abstract
     * @param {string} fileId - ID del file
     * @returns {Promise<Object>} - Oggetto JSON
     */
    async readFileAsJSON(fileId) {
        throw new Error('Metodo readFileAsJSON() non implementato');
    }

    /**
     * Aggiorna il contenuto di un file
     * @abstract
     * @param {string} fileId - ID del file
     * @param {string|Blob|ArrayBuffer} content - Nuovo contenuto
     * @param {string} [mimeType] - MIME type (opzionale)
     * @returns {Promise<Object>} - Metadati aggiornati
     */
    async updateFile(fileId, content, mimeType) {
        throw new Error('Metodo updateFile() non implementato');
    }

    /**
     * Elimina un file
     * @abstract
     * @param {string} fileId - ID del file
     * @returns {Promise<void>}
     */
    async deleteFile(fileId) {
        throw new Error('Metodo deleteFile() non implementato');
    }

    /**
     * Sposta un file in un'altra cartella
     * @abstract
     * @param {string} fileId - ID del file
     * @param {string} newParentId - ID della nuova cartella genitore
     * @param {string} [oldParentId] - ID della vecchia cartella genitore
     * @returns {Promise<Object>} - Metadati aggiornati
     */
    async moveFile(fileId, newParentId, oldParentId) {
        throw new Error('Metodo moveFile() non implementato');
    }

    /**
     * Copia un file
     * @abstract
     * @param {string} fileId - ID del file da copiare
     * @param {string} [newName] - Nome del nuovo file
     * @param {string} [parentId] - ID della cartella destinazione
     * @returns {Promise<Object>} - Metadati del file copiato
     */
    async copyFile(fileId, newName, parentId) {
        throw new Error('Metodo copyFile() non implementato');
    }

    /**
     * Rinomina un file
     * @abstract
     * @param {string} fileId - ID del file
     * @param {string} newName - Nuovo nome
     * @returns {Promise<Object>} - Metadati aggiornati
     */
    async renameFile(fileId, newName) {
        throw new Error('Metodo renameFile() non implementato');
    }

    /**
     * Ottiene i metadati di un file
     * @abstract
     * @param {string} fileId - ID del file
     * @returns {Promise<Object>} - Metadati del file
     */
    async getFileMetadata(fileId) {
        throw new Error('Metodo getFileMetadata() non implementato');
    }

    /**
     * Cerca un file per nome in una cartella
     * @abstract
     * @param {string} name - Nome del file
     * @param {string} [parentId] - ID della cartella
     * @returns {Promise<Object|null>} - Metadati del file o null
     */
    async findFile(name, parentId) {
        throw new Error('Metodo findFile() non implementato');
    }

    // ==========================================
    // Condivisione
    // ==========================================

    /**
     * Crea un link di condivisione per un file
     * @abstract
     * @param {string} fileId - ID del file
     * @returns {Promise<string>} - URL di condivisione
     */
    async createShareLink(fileId) {
        throw new Error('Metodo createShareLink() non implementato');
    }

    /**
     * Rimuove la condivisione di un file
     * @abstract
     * @param {string} fileId - ID del file
     * @returns {Promise<void>}
     */
    async removeShareLink(fileId) {
        throw new Error('Metodo removeShareLink() non implementato');
    }

    // ==========================================
    // Utility
    // ==========================================

    /**
     * Ottiene lo spazio di storage utilizzato/disponibile
     * @abstract
     * @returns {Promise<Object>} - { used, total, free }
     */
    async getStorageQuota() {
        throw new Error('Metodo getStorageQuota() non implementato');
    }

    /**
     * Esporta un file per il download locale
     * @abstract
     * @param {string} fileId - ID del file
     * @returns {Promise<Blob>} - Blob del file
     */
    async exportFile(fileId) {
        throw new Error('Metodo exportFile() non implementato');
    }
}

/**
 * Factory per creare istanze di storage provider
 */
export class StorageFactory {
    static providers = new Map();

    /**
     * Registra un provider di storage
     * @param {string} name - Nome del provider
     * @param {typeof StorageInterface} providerClass - Classe del provider
     */
    static register(name, providerClass) {
        StorageFactory.providers.set(name, providerClass);
    }

    /**
     * Crea un'istanza del provider specificato
     * @param {string} name - Nome del provider
     * @returns {StorageInterface}
     */
    static create(name) {
        const ProviderClass = StorageFactory.providers.get(name);
        if (!ProviderClass) {
            throw new Error(`Provider di storage "${name}" non trovato`);
        }
        return new ProviderClass();
    }

    /**
     * Lista i provider disponibili
     * @returns {string[]}
     */
    static listProviders() {
        return Array.from(StorageFactory.providers.keys());
    }
}
