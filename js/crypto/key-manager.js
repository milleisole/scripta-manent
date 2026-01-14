/**
 * Gestore delle chiavi di cifratura per Scripta Manent
 * Gestisce DEK (Data Encryption Key) e KEK (Key Encryption Key)
 */

import { CONFIG } from '../config.js';
import { Encryption } from './encryption.js';
import { hashSHA256 } from '../utils/hash.js';

/**
 * Classe per la gestione delle chiavi crittografiche
 */
export class KeyManager {
    constructor(storage) {
        this.storage = storage;
        this.dek = null; // Data Encryption Key (in memoria)
        this.vaultFileId = null;
        this.isInitialized = false;
    }

    /**
     * Verifica se esiste un vault (password già configurata)
     * @returns {Promise<boolean>}
     */
    async hasVault() {
        try {
            const rootId = this.storage.getRootFolderId();
            const vault = await this.storage.findFile(CONFIG.VAULT_FILE_NAME, rootId);
            return vault !== null;
        } catch (error) {
            console.error('Errore verifica vault:', error);
            return false;
        }
    }

    /**
     * Configura una nuova password master
     * Genera DEK, deriva KEK dalla password, cifra DEK
     * @param {string} password - La password master scelta dall'utente
     * @param {string} googleUserId - ID utente Google per recovery
     * @returns {Promise<void>}
     */
    async setupPassword(password, googleUserId) {
        // Genera DEK random
        this.dek = await Encryption.generateDEK();

        // Genera salt per PBKDF2
        const salt = Encryption.generateRandomBytes(CONFIG.CRYPTO.SALT_LENGTH);

        // Deriva KEK dalla password
        const kek = await Encryption.deriveKEK(password, salt);

        // Esporta DEK come raw bytes
        const dekRaw = await Encryption.exportKey(this.dek);

        // Cifra DEK con KEK
        const { iv, ciphertext } = await Encryption.encrypt(dekRaw, kek);

        // Crea hash per recovery
        const recoveryData = googleUserId + Encryption.arrayBufferToBase64(salt);
        const recoveryHash = await hashSHA256(recoveryData);

        // Crea oggetto vault
        const vault = {
            version: 1,
            salt: Encryption.arrayBufferToBase64(salt),
            iv: Encryption.arrayBufferToBase64(iv),
            encryptedDEK: Encryption.arrayBufferToBase64(ciphertext),
            recoveryHash: recoveryHash,
            createdAt: new Date().toISOString()
        };

        // Salva vault su Drive
        const rootId = this.storage.getRootFolderId();
        const result = await this.storage.createFile(
            CONFIG.VAULT_FILE_NAME,
            JSON.stringify(vault),
            'application/json',
            rootId
        );

        this.vaultFileId = result.id;
        this.isInitialized = true;
    }

    /**
     * Sblocca il vault con la password
     * @param {string} password - La password master
     * @returns {Promise<boolean>} - true se la password è corretta
     */
    async unlock(password) {
        try {
            // Carica il vault
            const vault = await this.loadVault();
            if (!vault) {
                throw new Error('Vault non trovato');
            }

            // Decodifica i dati dal vault
            const salt = Encryption.base64ToArrayBuffer(vault.salt);
            const iv = Encryption.base64ToArrayBuffer(vault.iv);
            const encryptedDEK = Encryption.base64ToArrayBuffer(vault.encryptedDEK);

            // Deriva KEK dalla password
            const kek = await Encryption.deriveKEK(password, salt);

            // Decifra DEK
            const dekRaw = await Encryption.decrypt(encryptedDEK, kek, iv);

            // Importa DEK
            this.dek = await Encryption.importKey(dekRaw);
            this.isInitialized = true;

            return true;
        } catch (error) {
            console.error('Errore sblocco vault:', error);
            this.dek = null;
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Verifica se il recovery è possibile per questo utente
     * @param {string} googleUserId - ID utente Google
     * @returns {Promise<boolean>}
     */
    async canRecover(googleUserId) {
        try {
            const vault = await this.loadVault();
            if (!vault) {
                return false;
            }

            const recoveryData = googleUserId + vault.salt;
            const hash = await hashSHA256(recoveryData);

            return hash === vault.recoveryHash;
        } catch (error) {
            console.error('Errore verifica recovery:', error);
            return false;
        }
    }

    /**
     * Recupera l'accesso con una nuova password
     * Mantiene la stessa DEK ma la ri-cifra con una nuova KEK
     * @param {string} newPassword - La nuova password
     * @param {string} googleUserId - ID utente Google (per verifica)
     * @returns {Promise<boolean>}
     */
    async recoverWithNewPassword(newPassword, googleUserId) {
        try {
            // Verifica che il recovery sia autorizzato
            if (!await this.canRecover(googleUserId)) {
                throw new Error('Recovery non autorizzato per questo utente');
            }

            // Carica il vault attuale
            const vault = await this.loadVault();
            if (!vault) {
                throw new Error('Vault non trovato');
            }

            // Nota: in un vero sistema di recovery, dovremmo avere un meccanismo
            // per recuperare la DEK. Qui assumiamo che la DEK sia già in memoria
            // (utente autenticato con Google ma ha dimenticato la password)
            if (!this.dek) {
                throw new Error('DEK non disponibile. Il recovery richiede autenticazione Google.');
            }

            // Genera nuovo salt
            const newSalt = Encryption.generateRandomBytes(CONFIG.CRYPTO.SALT_LENGTH);

            // Deriva nuova KEK
            const newKek = await Encryption.deriveKEK(newPassword, newSalt);

            // Esporta e ri-cifra DEK
            const dekRaw = await Encryption.exportKey(this.dek);
            const { iv, ciphertext } = await Encryption.encrypt(dekRaw, newKek);

            // Crea nuovo recovery hash
            const recoveryData = googleUserId + Encryption.arrayBufferToBase64(newSalt);
            const recoveryHash = await hashSHA256(recoveryData);

            // Aggiorna vault
            const newVault = {
                version: vault.version,
                salt: Encryption.arrayBufferToBase64(newSalt),
                iv: Encryption.arrayBufferToBase64(iv),
                encryptedDEK: Encryption.arrayBufferToBase64(ciphertext),
                recoveryHash: recoveryHash,
                createdAt: vault.createdAt,
                updatedAt: new Date().toISOString()
            };

            // Salva vault aggiornato
            await this.storage.updateFile(
                this.vaultFileId,
                JSON.stringify(newVault),
                'application/json'
            );

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Errore recovery password:', error);
            return false;
        }
    }

    /**
     * Cambia la password master
     * @param {string} currentPassword - Password attuale
     * @param {string} newPassword - Nuova password
     * @param {string} googleUserId - ID utente Google
     * @returns {Promise<boolean>}
     */
    async changePassword(currentPassword, newPassword, googleUserId) {
        // Prima verifica la password attuale
        const unlocked = await this.unlock(currentPassword);
        if (!unlocked) {
            throw new Error('Password attuale non corretta');
        }

        // Poi esegui il "recovery" con la nuova password
        return await this.recoverWithNewPassword(newPassword, googleUserId);
    }

    /**
     * Carica il vault da Drive
     * @returns {Promise<Object|null>}
     */
    async loadVault() {
        try {
            const rootId = this.storage.getRootFolderId();
            const vaultFile = await this.storage.findFile(CONFIG.VAULT_FILE_NAME, rootId);

            if (!vaultFile) {
                return null;
            }

            this.vaultFileId = vaultFile.id;
            return await this.storage.readFileAsJSON(vaultFile.id);
        } catch (error) {
            console.error('Errore caricamento vault:', error);
            return null;
        }
    }

    /**
     * Cifra contenuto con la DEK
     * @param {string|ArrayBuffer|Uint8Array} data - Dati da cifrare
     * @returns {Promise<Blob>}
     */
    async encrypt(data) {
        if (!this.dek) {
            throw new Error('KeyManager non inizializzato. Sbloccare prima il vault.');
        }
        return await Encryption.encryptFile(data, this.dek);
    }

    /**
     * Decifra contenuto con la DEK
     * @param {Blob|ArrayBuffer} encryptedData - Dati cifrati
     * @returns {Promise<ArrayBuffer>}
     */
    async decrypt(encryptedData) {
        if (!this.dek) {
            throw new Error('KeyManager non inizializzato. Sbloccare prima il vault.');
        }
        return await Encryption.decryptFile(encryptedData, this.dek);
    }

    /**
     * Cifra una stringa
     * @param {string} text - Testo da cifrare
     * @returns {Promise<string>}
     */
    async encryptString(text) {
        if (!this.dek) {
            throw new Error('KeyManager non inizializzato');
        }
        return await Encryption.encryptString(text, this.dek);
    }

    /**
     * Decifra una stringa
     * @param {string} encrypted - Testo cifrato
     * @returns {Promise<string>}
     */
    async decryptString(encrypted) {
        if (!this.dek) {
            throw new Error('KeyManager non inizializzato');
        }
        return await Encryption.decryptString(encrypted, this.dek);
    }

    /**
     * Verifica se il KeyManager è pronto per cifrare/decifrare
     * @returns {boolean}
     */
    isReady() {
        return this.isInitialized && this.dek !== null;
    }

    /**
     * Blocca il vault (rimuove DEK dalla memoria)
     */
    lock() {
        this.dek = null;
        this.isInitialized = false;
    }
}

export default KeyManager;
