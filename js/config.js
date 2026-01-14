/**
 * Configurazione dell'applicazione Scripta Manent
 * Contiene le costanti e le configurazioni per Google API
 */

export const CONFIG = {
    // Configurazione Google OAuth
    // IMPORTANTE: Sostituire con il proprio Client ID da Google Cloud Console
    GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',

    // Scope necessari per Google Drive (solo accesso ai file creati dall'app)
    GOOGLE_SCOPES: 'https://www.googleapis.com/auth/drive.file',

    // URL per il discovery document di Google API
    GOOGLE_DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',

    // Nome della cartella root su Google Drive
    ROOT_FOLDER_NAME: 'scripta-manent',

    // Nomi dei file di sistema
    INDEX_FILE_NAME: 'scripta-manent.json',
    VAULT_FILE_NAME: 'vault.enc',
    SEARCH_INDEX_FILE_NAME: 'search-index.json',

    // Cartelle predefinite
    FOLDERS: {
        NOTES: 'notes',
        FILES: 'files',
        MEDIA: 'media',
        TRASH: '.trash'
    },

    // Impostazioni predefinite
    DEFAULT_SETTINGS: {
        theme: 'auto', // 'light', 'dark', 'auto'
        language: 'it',
        trashRetentionDays: 15,
        maxVersionsSmallFile: 2,
        maxVersionsLargeFile: 1,
        largeFileSizeThreshold: 5 * 1024 * 1024, // 5MB
        autoSaveDelay: 2000, // 2 secondi di debounce
        searchIndexMaxWords: 500
    },

    // Versione dell'app
    APP_VERSION: '1.0.0',

    // Configurazione cifratura
    CRYPTO: {
        PBKDF2_ITERATIONS: 100000,
        KEY_LENGTH: 256, // bit
        SALT_LENGTH: 16, // byte
        IV_LENGTH: 12 // byte per AES-GCM
    },

    // MIME types per categorizzazione
    MIME_TYPES: {
        NOTES: ['text/markdown', 'text/plain'],
        IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        VIDEOS: ['video/mp4', 'video/webm', 'video/quicktime'],
        AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
        DOCUMENTS: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ]
    },

    // Estensioni per note
    NOTE_EXTENSIONS: ['.md', '.txt', '.markdown'],

    // Dimensione massima per preview
    MAX_PREVIEW_SIZE: 1024 * 100, // 100KB

    // Timeout per le richieste API
    API_TIMEOUT: 30000, // 30 secondi

    // Configurazione cache locale
    CACHE: {
        INDEX_KEY: 'scripta_index',
        SETTINGS_KEY: 'scripta_settings',
        AUTH_KEY: 'scripta_auth',
        SEARCH_KEY: 'scripta_search'
    }
};

/**
 * Determina il tipo di item in base al MIME type
 * @param {string} mimeType - Il MIME type del file
 * @returns {string} - 'note', 'media', o 'file'
 */
export function getItemType(mimeType) {
    if (CONFIG.MIME_TYPES.NOTES.includes(mimeType)) {
        return 'note';
    }
    if (CONFIG.MIME_TYPES.IMAGES.includes(mimeType) ||
        CONFIG.MIME_TYPES.VIDEOS.includes(mimeType) ||
        CONFIG.MIME_TYPES.AUDIO.includes(mimeType)) {
        return 'media';
    }
    return 'file';
}

/**
 * Determina se un file è un'immagine
 * @param {string} mimeType - Il MIME type del file
 * @returns {boolean}
 */
export function isImage(mimeType) {
    return CONFIG.MIME_TYPES.IMAGES.includes(mimeType);
}

/**
 * Determina se un file è un video
 * @param {string} mimeType - Il MIME type del file
 * @returns {boolean}
 */
export function isVideo(mimeType) {
    return CONFIG.MIME_TYPES.VIDEOS.includes(mimeType);
}

/**
 * Determina se un file è una nota
 * @param {string} filename - Nome del file
 * @returns {boolean}
 */
export function isNote(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    return CONFIG.NOTE_EXTENSIONS.includes('.' + ext);
}

/**
 * Formatta la dimensione del file in formato leggibile
 * @param {number} bytes - Dimensione in byte
 * @returns {string} - Dimensione formattata (es. "1.5 MB")
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Formatta una data in formato locale
 * @param {string|Date} date - Data da formattare
 * @returns {string} - Data formattata
 */
export function formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    // Meno di un minuto fa
    if (diff < 60000) {
        return 'Adesso';
    }

    // Meno di un'ora fa
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min fa`;
    }

    // Oggi
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }

    // Ieri
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
        return 'Ieri';
    }

    // Quest'anno
    if (d.getFullYear() === now.getFullYear()) {
        return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    }

    // Altro
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Genera un UUID v4
 * @returns {string}
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Debounce di una funzione
 * @param {Function} func - Funzione da eseguire
 * @param {number} wait - Millisecondi di attesa
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle di una funzione
 * @param {Function} func - Funzione da eseguire
 * @param {number} limit - Millisecondi minimo tra esecuzioni
 * @returns {Function}
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
