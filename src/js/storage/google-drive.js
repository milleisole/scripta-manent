/**
 * Implementazione del provider di storage per Google Drive
 * Utilizza Google Drive API v3
 */

import { StorageInterface, StorageFactory } from './storage-interface.js';
import { CONFIG } from '../config.js';

/**
 * Provider di storage per Google Drive
 */
export class GoogleDriveStorage extends StorageInterface {
    constructor() {
        super('google-drive');
        this.tokenClient = null;
        this.accessToken = null;
        this.rootFolderId = null;
        this.folderCache = new Map();
    }

    // ==========================================
    // Autenticazione
    // ==========================================

    /**
     * Inizializza il client Google API
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            // Carica la libreria Google Identity Services
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;

            script.onload = async () => {
                try {
                    // Inizializza il token client
                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: CONFIG.GOOGLE_CLIENT_ID,
                        scope: CONFIG.GOOGLE_SCOPES,
                        callback: () => {} // Verrà impostato durante il login
                    });

                    // Prova a recuperare il token salvato
                    const savedToken = this.getSavedToken();
                    if (savedToken) {
                        this.accessToken = savedToken;
                        this.isAuthenticated = true;
                        await this.initializeRootFolder();
                    }

                    resolve(true);
                } catch (error) {
                    console.error('Errore inizializzazione Google API:', error);
                    reject(error);
                }
            };

            script.onerror = () => {
                reject(new Error('Impossibile caricare Google Identity Services'));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Esegue il login con Google
     */
    async login() {
        return new Promise((resolve, reject) => {
            this.tokenClient.callback = async (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }

                this.accessToken = response.access_token;
                this.isAuthenticated = true;

                // Salva il token
                this.saveToken(response.access_token);

                // Ottieni info utente
                this.user = await this.getCurrentUser();

                // Inizializza la cartella root
                await this.initializeRootFolder();

                resolve(this.user);
            };

            // Richiedi il token
            if (this.accessToken) {
                // Token esistente, prova a usarlo o fai refresh
                this.tokenClient.requestAccessToken({ prompt: '' });
            } else {
                // Primo login, mostra il consent screen
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            }
        });
    }

    /**
     * Esegue il logout
     */
    async logout() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
        }

        this.accessToken = null;
        this.isAuthenticated = false;
        this.user = null;
        this.rootFolderId = null;
        this.folderCache.clear();

        // Rimuovi token salvato
        localStorage.removeItem(CONFIG.CACHE.AUTH_KEY);
    }

    /**
     * Verifica l'autenticazione
     */
    async checkAuth() {
        if (!this.accessToken) {
            return false;
        }

        try {
            // Prova a fare una richiesta semplice per verificare il token
            await this.makeRequest('https://www.googleapis.com/drive/v3/about?fields=user');
            return true;
        } catch (error) {
            this.accessToken = null;
            this.isAuthenticated = false;
            localStorage.removeItem(CONFIG.CACHE.AUTH_KEY);
            return false;
        }
    }

    /**
     * Ottiene i dati dell'utente corrente
     */
    async getCurrentUser() {
        const response = await this.makeRequest(
            'https://www.googleapis.com/drive/v3/about?fields=user'
        );

        return {
            id: response.user.permissionId,
            email: response.user.emailAddress,
            name: response.user.displayName,
            avatar: response.user.photoLink
        };
    }

    // ==========================================
    // Gestione cartelle
    // ==========================================

    /**
     * Inizializza la struttura delle cartelle root
     */
    async initializeRootFolder() {
        // Cerca o crea la cartella root
        this.rootFolderId = await this.getOrCreateFolder(CONFIG.ROOT_FOLDER_NAME);

        // Crea le sottocartelle necessarie
        await Promise.all([
            this.getOrCreateFolder(CONFIG.FOLDERS.NOTES, this.rootFolderId),
            this.getOrCreateFolder(CONFIG.FOLDERS.FILES, this.rootFolderId),
            this.getOrCreateFolder(CONFIG.FOLDERS.MEDIA, this.rootFolderId),
            this.getOrCreateFolder(CONFIG.FOLDERS.TRASH, this.rootFolderId)
        ]);

        return this.rootFolderId;
    }

    /**
     * Crea una cartella su Google Drive
     */
    async createFolder(name, parentId = null) {
        const metadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder'
        };

        if (parentId) {
            metadata.parents = [parentId];
        }

        const response = await this.makeRequest(
            'https://www.googleapis.com/drive/v3/files',
            {
                method: 'POST',
                body: JSON.stringify(metadata)
            }
        );

        // Aggiorna cache
        const cacheKey = `${parentId || 'root'}:${name}`;
        this.folderCache.set(cacheKey, response.id);

        return response;
    }

    /**
     * Cerca una cartella per nome
     */
    async findFolder(name, parentId = null) {
        // Controlla cache
        const cacheKey = `${parentId || 'root'}:${name}`;
        if (this.folderCache.has(cacheKey)) {
            return { id: this.folderCache.get(cacheKey) };
        }

        let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }

        const response = await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
        );

        if (response.files && response.files.length > 0) {
            this.folderCache.set(cacheKey, response.files[0].id);
            return response.files[0];
        }

        return null;
    }

    /**
     * Ottiene o crea una cartella
     */
    async getOrCreateFolder(name, parentId = null) {
        const existing = await this.findFolder(name, parentId);

        if (existing) {
            return existing.id;
        }

        const created = await this.createFolder(name, parentId);
        return created.id;
    }

    /**
     * Lista il contenuto di una cartella
     */
    async listFolder(folderId) {
        const query = `'${folderId}' in parents and trashed=false`;
        const fields = 'files(id,name,mimeType,size,createdTime,modifiedTime,parents)';

        const response = await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${fields}&orderBy=modifiedTime desc`
        );

        return response.files || [];
    }

    /**
     * Ottiene l'ID di una cartella di sistema
     */
    async getSystemFolderId(folderName) {
        if (!this.rootFolderId) {
            await this.initializeRootFolder();
        }
        return await this.getOrCreateFolder(folderName, this.rootFolderId);
    }

    // ==========================================
    // Gestione file
    // ==========================================

    /**
     * Crea un nuovo file
     */
    async createFile(name, content, mimeType, parentId = null) {
        const metadata = {
            name: name,
            mimeType: mimeType
        };

        if (parentId) {
            metadata.parents = [parentId];
        } else if (this.rootFolderId) {
            metadata.parents = [this.rootFolderId];
        }

        // Prepara il contenuto
        let body;
        if (typeof content === 'string') {
            body = new Blob([content], { type: mimeType });
        } else if (content instanceof Blob) {
            body = content;
        } else if (content instanceof ArrayBuffer) {
            body = new Blob([content], { type: mimeType });
        } else {
            body = new Blob([JSON.stringify(content)], { type: 'application/json' });
        }

        // Usa multipart upload
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadataString = JSON.stringify(metadata);

        const multipartBody = await this.buildMultipartBody(
            boundary,
            metadataString,
            body,
            mimeType
        );

        const response = await this.makeRequest(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime',
            {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartBody
            }
        );

        return response;
    }

    /**
     * Costruisce il body multipart per l'upload
     */
    async buildMultipartBody(boundary, metadata, content, mimeType) {
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`;
        const contentHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

        // Converti tutto in Uint8Array
        const encoder = new TextEncoder();
        const metadataBytes = encoder.encode(metadataPart);
        const headerBytes = encoder.encode(contentHeader);
        const closeBytes = encoder.encode(closeDelimiter);

        let contentBytes;
        if (content instanceof Blob) {
            contentBytes = new Uint8Array(await content.arrayBuffer());
        } else {
            contentBytes = encoder.encode(content);
        }

        // Combina tutto
        const totalLength = metadataBytes.length + headerBytes.length + contentBytes.length + closeBytes.length;
        const result = new Uint8Array(totalLength);

        let offset = 0;
        result.set(metadataBytes, offset);
        offset += metadataBytes.length;
        result.set(headerBytes, offset);
        offset += headerBytes.length;
        result.set(contentBytes, offset);
        offset += contentBytes.length;
        result.set(closeBytes, offset);

        return result;
    }

    /**
     * Legge il contenuto di un file
     */
    async readFile(fileId) {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Errore lettura file: ${response.status}`);
        }

        return response.arrayBuffer();
    }

    /**
     * Legge il contenuto di un file come testo
     */
    async readFileAsText(fileId) {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Errore lettura file: ${response.status}`);
        }

        return response.text();
    }

    /**
     * Legge il contenuto di un file come JSON
     */
    async readFileAsJSON(fileId) {
        const text = await this.readFileAsText(fileId);
        return JSON.parse(text);
    }

    /**
     * Aggiorna il contenuto di un file
     */
    async updateFile(fileId, content, mimeType = 'application/octet-stream') {
        let body;
        if (typeof content === 'string') {
            body = content;
        } else if (content instanceof Blob) {
            body = content;
        } else {
            body = JSON.stringify(content);
            mimeType = 'application/json';
        }

        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,mimeType,size,modifiedTime`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': mimeType
                },
                body: body
            }
        );

        if (!response.ok) {
            throw new Error(`Errore aggiornamento file: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Elimina un file
     */
    async deleteFile(fileId) {
        await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            { method: 'DELETE' }
        );
    }

    /**
     * Sposta un file
     */
    async moveFile(fileId, newParentId, oldParentId) {
        let url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}`;
        if (oldParentId) {
            url += `&removeParents=${oldParentId}`;
        }

        return await this.makeRequest(url, {
            method: 'PATCH',
            body: JSON.stringify({})
        });
    }

    /**
     * Copia un file
     */
    async copyFile(fileId, newName, parentId) {
        const body = {};
        if (newName) body.name = newName;
        if (parentId) body.parents = [parentId];

        return await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files/${fileId}/copy`,
            {
                method: 'POST',
                body: JSON.stringify(body)
            }
        );
    }

    /**
     * Rinomina un file
     */
    async renameFile(fileId, newName) {
        return await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ name: newName })
            }
        );
    }

    /**
     * Ottiene i metadati di un file
     */
    async getFileMetadata(fileId) {
        return await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents`
        );
    }

    /**
     * Cerca un file per nome
     */
    async findFile(name, parentId = null) {
        let query = `name='${name}' and trashed=false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }

        const response = await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size)`
        );

        return response.files && response.files.length > 0 ? response.files[0] : null;
    }

    // ==========================================
    // Condivisione
    // ==========================================

    /**
     * Crea un link di condivisione
     */
    async createShareLink(fileId) {
        // Imposta i permessi per "chiunque con il link"
        await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
            {
                method: 'POST',
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }
        );

        // Ottieni il link
        const file = await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,webContentLink`
        );

        return file.webContentLink || file.webViewLink;
    }

    /**
     * Rimuove la condivisione
     */
    async removeShareLink(fileId) {
        // Ottieni i permessi attuali
        const permissions = await this.makeRequest(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`
        );

        // Rimuovi i permessi "anyone"
        for (const perm of permissions.permissions || []) {
            if (perm.type === 'anyone') {
                await this.makeRequest(
                    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${perm.id}`,
                    { method: 'DELETE' }
                );
            }
        }
    }

    // ==========================================
    // Utility
    // ==========================================

    /**
     * Ottiene la quota di storage
     */
    async getStorageQuota() {
        const response = await this.makeRequest(
            'https://www.googleapis.com/drive/v3/about?fields=storageQuota'
        );

        const quota = response.storageQuota;
        return {
            used: parseInt(quota.usage || 0),
            total: parseInt(quota.limit || 0),
            free: parseInt(quota.limit || 0) - parseInt(quota.usage || 0)
        };
    }

    /**
     * Esporta un file come Blob
     */
    async exportFile(fileId) {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Errore export file: ${response.status}`);
        }

        return response.blob();
    }

    /**
     * Esegue una richiesta HTTP a Google API
     */
    async makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        const response = await fetch(url, mergedOptions);

        // Se il token è scaduto, prova a rinnovarlo
        if (response.status === 401) {
            await this.login();
            mergedOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
            const retryResponse = await fetch(url, mergedOptions);

            if (!retryResponse.ok) {
                throw new Error(`Errore API Google: ${retryResponse.status}`);
            }

            if (retryResponse.status === 204) {
                return null;
            }

            return retryResponse.json();
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `Errore API: ${response.status}`);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    /**
     * Salva il token in localStorage
     */
    saveToken(token) {
        try {
            localStorage.setItem(CONFIG.CACHE.AUTH_KEY, token);
        } catch (e) {
            console.warn('Impossibile salvare token:', e);
        }
    }

    /**
     * Recupera il token salvato
     */
    getSavedToken() {
        try {
            return localStorage.getItem(CONFIG.CACHE.AUTH_KEY);
        } catch (e) {
            return null;
        }
    }

    /**
     * Ottiene la cartella root
     */
    getRootFolderId() {
        return this.rootFolderId;
    }
}

// Registra il provider nella factory
StorageFactory.register('google-drive', GoogleDriveStorage);

export default GoogleDriveStorage;
