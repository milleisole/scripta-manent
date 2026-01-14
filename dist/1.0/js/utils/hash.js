/**
 * Utility per hashing con SHA-256
 * Utilizza Web Crypto API
 */

/**
 * Calcola l'hash SHA-256 di una stringa
 * @param {string} message - Il messaggio da hashare
 * @returns {Promise<string>} - Hash in formato esadecimale
 */
export async function hashSHA256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return arrayBufferToHex(hashBuffer);
}

/**
 * Calcola l'hash SHA-256 di un ArrayBuffer
 * @param {ArrayBuffer} buffer - Il buffer da hashare
 * @returns {Promise<string>} - Hash in formato esadecimale
 */
export async function hashBuffer(buffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return arrayBufferToHex(hashBuffer);
}

/**
 * Calcola l'hash SHA-256 di un file
 * @param {Blob|File} file - Il file da hashare
 * @returns {Promise<string>} - Hash in formato esadecimale con prefisso "sha256:"
 */
export async function hashFile(file) {
    const buffer = await file.arrayBuffer();
    const hash = await hashBuffer(buffer);
    return `sha256:${hash}`;
}

/**
 * Converte ArrayBuffer in stringa esadecimale
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Converte stringa esadecimale in Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function hexToArrayBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

/**
 * Verifica se un hash corrisponde al contenuto
 * @param {string|ArrayBuffer|Blob} content - Il contenuto da verificare
 * @param {string} expectedHash - L'hash atteso (con o senza prefisso "sha256:")
 * @returns {Promise<boolean>}
 */
export async function verifyHash(content, expectedHash) {
    let computedHash;

    if (content instanceof Blob) {
        computedHash = await hashFile(content);
    } else if (content instanceof ArrayBuffer) {
        computedHash = 'sha256:' + await hashBuffer(content);
    } else {
        computedHash = 'sha256:' + await hashSHA256(content);
    }

    // Normalizza l'hash atteso
    const normalizedExpected = expectedHash.startsWith('sha256:')
        ? expectedHash
        : 'sha256:' + expectedHash;

    return computedHash === normalizedExpected;
}

/**
 * Genera un hash breve per identificatori
 * @param {string} input - Input da hashare
 * @param {number} [length=8] - Lunghezza dell'output
 * @returns {Promise<string>}
 */
export async function shortHash(input, length = 8) {
    const fullHash = await hashSHA256(input);
    return fullHash.substring(0, length);
}

export default {
    hashSHA256,
    hashBuffer,
    hashFile,
    arrayBufferToHex,
    hexToArrayBuffer,
    verifyHash,
    shortHash
};
