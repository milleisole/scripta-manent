/**
 * Modulo di cifratura per Scripta Manent
 * Utilizza Web Crypto API per AES-256-GCM
 */

import { CONFIG } from '../config.js';

/**
 * Classe per la gestione della cifratura AES-256-GCM
 */
export class Encryption {
    /**
     * Genera un array di byte random
     * @param {number} length - Lunghezza in byte
     * @returns {Uint8Array}
     */
    static generateRandomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    /**
     * Genera una chiave AES-256 random (DEK)
     * @returns {Promise<CryptoKey>}
     */
    static async generateDEK() {
        return await crypto.subtle.generateKey(
            {
                name: 'AES-GCM',
                length: CONFIG.CRYPTO.KEY_LENGTH
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Deriva una chiave dalla password usando PBKDF2 (KEK)
     * @param {string} password - La password dell'utente
     * @param {Uint8Array} salt - Il salt per la derivazione
     * @returns {Promise<CryptoKey>}
     */
    static async deriveKEK(password, salt) {
        // Converti la password in bytes
        const encoder = new TextEncoder();
        const passwordBytes = encoder.encode(password);

        // Importa la password come chiave base
        const baseKey = await crypto.subtle.importKey(
            'raw',
            passwordBytes,
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // Deriva la KEK usando PBKDF2
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: CONFIG.CRYPTO.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            baseKey,
            {
                name: 'AES-GCM',
                length: CONFIG.CRYPTO.KEY_LENGTH
            },
            true, // extractable per export
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Cifra dati con AES-256-GCM
     * @param {ArrayBuffer|Uint8Array|string} data - Dati da cifrare
     * @param {CryptoKey} key - Chiave AES
     * @returns {Promise<{iv: Uint8Array, ciphertext: ArrayBuffer}>}
     */
    static async encrypt(data, key) {
        // Genera IV random
        const iv = this.generateRandomBytes(CONFIG.CRYPTO.IV_LENGTH);

        // Converti i dati se necessario
        let dataBuffer;
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            dataBuffer = encoder.encode(data);
        } else if (data instanceof Uint8Array) {
            dataBuffer = data;
        } else {
            dataBuffer = new Uint8Array(data);
        }

        // Cifra
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            dataBuffer
        );

        return { iv, ciphertext };
    }

    /**
     * Decifra dati con AES-256-GCM
     * @param {ArrayBuffer} ciphertext - Dati cifrati
     * @param {CryptoKey} key - Chiave AES
     * @param {Uint8Array} iv - Initialization Vector
     * @returns {Promise<ArrayBuffer>}
     */
    static async decrypt(ciphertext, key, iv) {
        return await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            ciphertext
        );
    }

    /**
     * Decifra e restituisce come stringa
     * @param {ArrayBuffer} ciphertext - Dati cifrati
     * @param {CryptoKey} key - Chiave AES
     * @param {Uint8Array} iv - Initialization Vector
     * @returns {Promise<string>}
     */
    static async decryptToString(ciphertext, key, iv) {
        const plaintext = await this.decrypt(ciphertext, key, iv);
        const decoder = new TextDecoder();
        return decoder.decode(plaintext);
    }

    /**
     * Esporta una CryptoKey come raw bytes
     * @param {CryptoKey} key - La chiave da esportare
     * @returns {Promise<ArrayBuffer>}
     */
    static async exportKey(key) {
        return await crypto.subtle.exportKey('raw', key);
    }

    /**
     * Importa una chiave da raw bytes
     * @param {ArrayBuffer|Uint8Array} keyData - I bytes della chiave
     * @returns {Promise<CryptoKey>}
     */
    static async importKey(keyData) {
        return await crypto.subtle.importKey(
            'raw',
            keyData,
            {
                name: 'AES-GCM',
                length: CONFIG.CRYPTO.KEY_LENGTH
            },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Converte ArrayBuffer in stringa Base64
     * @param {ArrayBuffer|Uint8Array} buffer
     * @returns {string}
     */
    static arrayBufferToBase64(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Converte stringa Base64 in Uint8Array
     * @param {string} base64
     * @returns {Uint8Array}
     */
    static base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Cifra un file intero
     * @param {Blob|ArrayBuffer} fileData - Il contenuto del file
     * @param {CryptoKey} key - La chiave di cifratura (DEK)
     * @returns {Promise<Blob>} - File cifrato come Blob
     */
    static async encryptFile(fileData, key) {
        let dataBuffer;
        if (fileData instanceof Blob) {
            dataBuffer = await fileData.arrayBuffer();
        } else {
            dataBuffer = fileData;
        }

        const { iv, ciphertext } = await this.encrypt(dataBuffer, key);

        // Combina IV + ciphertext
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(ciphertext), iv.length);

        return new Blob([combined], { type: 'application/octet-stream' });
    }

    /**
     * Decifra un file intero
     * @param {Blob|ArrayBuffer} encryptedData - Il file cifrato
     * @param {CryptoKey} key - La chiave di decifratura (DEK)
     * @returns {Promise<ArrayBuffer>} - Contenuto decifrato
     */
    static async decryptFile(encryptedData, key) {
        let dataBuffer;
        if (encryptedData instanceof Blob) {
            dataBuffer = await encryptedData.arrayBuffer();
        } else {
            dataBuffer = encryptedData;
        }

        const dataArray = new Uint8Array(dataBuffer);

        // Estrai IV (primi 12 bytes)
        const iv = dataArray.slice(0, CONFIG.CRYPTO.IV_LENGTH);
        // Estrai ciphertext (resto)
        const ciphertext = dataArray.slice(CONFIG.CRYPTO.IV_LENGTH);

        return await this.decrypt(ciphertext, key, iv);
    }

    /**
     * Cifra una stringa e restituisce base64
     * @param {string} text - Testo da cifrare
     * @param {CryptoKey} key - Chiave AES
     * @returns {Promise<string>} - Formato: "base64(iv):base64(ciphertext)"
     */
    static async encryptString(text, key) {
        const { iv, ciphertext } = await this.encrypt(text, key);
        const ivBase64 = this.arrayBufferToBase64(iv);
        const ctBase64 = this.arrayBufferToBase64(ciphertext);
        return `${ivBase64}:${ctBase64}`;
    }

    /**
     * Decifra una stringa da formato base64
     * @param {string} encrypted - Formato: "base64(iv):base64(ciphertext)"
     * @param {CryptoKey} key - Chiave AES
     * @returns {Promise<string>}
     */
    static async decryptString(encrypted, key) {
        const [ivBase64, ctBase64] = encrypted.split(':');
        const iv = this.base64ToArrayBuffer(ivBase64);
        const ciphertext = this.base64ToArrayBuffer(ctBase64);
        return await this.decryptToString(ciphertext, key, iv);
    }
}

export default Encryption;
