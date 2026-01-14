/**
 * Service per la condivisione
 * Gestisce link condivisi, QR code e Web Share API
 */

import { generateQRCode, generateQRCodeDataURL } from '../utils/qrcode.js';

/**
 * Service per le operazioni di condivisione
 */
export class ShareService {
    /**
     * @param {Object} storage - Provider di storage
     */
    constructor(storage) {
        this.storage = storage;
    }

    /**
     * Crea un link di condivisione per un file
     * @param {string} fileId - ID del file Google Drive
     * @returns {Promise<string>} - URL di condivisione
     */
    async createShareLink(fileId) {
        return await this.storage.createShareLink(fileId);
    }

    /**
     * Rimuove la condivisione di un file
     * @param {string} fileId
     * @returns {Promise<void>}
     */
    async removeShareLink(fileId) {
        return await this.storage.removeShareLink(fileId);
    }

    /**
     * Genera un QR code per un URL
     * @param {string} url - URL da codificare
     * @param {Object} [options] - Opzioni di generazione
     * @returns {HTMLCanvasElement}
     */
    generateQRCode(url, options = {}) {
        return generateQRCode(url, {
            size: options.size || 256,
            margin: options.margin || 4,
            darkColor: options.darkColor || '#000000',
            lightColor: options.lightColor || '#ffffff'
        });
    }

    /**
     * Genera un QR code come data URL
     * @param {string} url
     * @param {Object} [options]
     * @returns {string}
     */
    generateQRCodeDataURL(url, options = {}) {
        return generateQRCodeDataURL(url, options);
    }

    /**
     * Crea link condiviso e genera QR code
     * @param {string} fileId
     * @param {Object} [options]
     * @returns {Promise<{url: string, qrCode: HTMLCanvasElement, qrDataURL: string}>}
     */
    async shareWithQR(fileId, options = {}) {
        const url = await this.createShareLink(fileId);
        const qrCode = this.generateQRCode(url, options);
        const qrDataURL = this.generateQRCodeDataURL(url, options);

        return {
            url,
            qrCode,
            qrDataURL
        };
    }

    /**
     * Condividi file usando Web Share API
     * @param {Blob} blob - Il file da condividere
     * @param {string} filename - Nome del file
     * @param {string} [title] - Titolo della condivisione
     * @param {string} [text] - Testo aggiuntivo
     * @returns {Promise<boolean>} - true se condiviso con successo
     */
    async shareFile(blob, filename, title = null, text = null) {
        // Verifica supporto Web Share API con file
        if (!navigator.canShare) {
            console.log('Web Share API non supportata');
            return false;
        }

        const file = new File([blob], filename, { type: blob.type });
        const shareData = {
            files: [file],
            title: title || filename,
            text: text || 'Condiviso da Scripta Manent'
        };

        if (!navigator.canShare(shareData)) {
            console.log('Impossibile condividere questo tipo di file');
            return false;
        }

        try {
            await navigator.share(shareData);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                // Utente ha annullato
                return false;
            }
            console.error('Errore condivisione:', error);
            return false;
        }
    }

    /**
     * Condividi solo URL usando Web Share API
     * @param {string} url - URL da condividere
     * @param {string} [title] - Titolo
     * @param {string} [text] - Testo
     * @returns {Promise<boolean>}
     */
    async shareURL(url, title = null, text = null) {
        if (!navigator.share) {
            console.log('Web Share API non supportata');
            return false;
        }

        try {
            await navigator.share({
                url: url,
                title: title || 'Link condiviso',
                text: text || ''
            });
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                return false;
            }
            console.error('Errore condivisione URL:', error);
            return false;
        }
    }

    /**
     * Verifica se Web Share API è disponibile
     * @returns {boolean}
     */
    isWebShareSupported() {
        return 'share' in navigator;
    }

    /**
     * Verifica se è possibile condividere file
     * @returns {boolean}
     */
    canShareFiles() {
        if (!navigator.canShare) return false;

        // Test con un file fittizio
        try {
            const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
            return navigator.canShare({ files: [testFile] });
        } catch {
            return false;
        }
    }

    /**
     * Scarica un file localmente (fallback quando share non è supportato)
     * @param {Blob} blob
     * @param {string} filename
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Copia un URL negli appunti
     * @param {string} url
     * @returns {Promise<boolean>}
     */
    async copyToClipboard(url) {
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch (error) {
            // Fallback per browser più vecchi
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();

            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch {
                document.body.removeChild(textArea);
                return false;
            }
        }
    }

    /**
     * Condivide con il metodo migliore disponibile
     * @param {Object} item - Note o FileItem
     * @param {Blob} [blob] - Contenuto del file (opzionale)
     * @returns {Promise<{method: string, success: boolean, url?: string}>}
     */
    async smartShare(item, blob = null) {
        const result = {
            method: '',
            success: false,
            url: null
        };

        // Se abbiamo il blob e Web Share supporta i file, usa quello
        if (blob && this.canShareFiles()) {
            const filename = item.name + (item.type === 'note' ? '.md' : '');
            result.success = await this.shareFile(blob, filename);
            result.method = 'webshare-file';
            return result;
        }

        // Altrimenti crea un link di condivisione
        if (item.contentFileId) {
            try {
                const url = await this.createShareLink(item.contentFileId);
                result.url = url;

                // Prova a condividere l'URL
                if (this.isWebShareSupported()) {
                    result.success = await this.shareURL(url, item.name);
                    result.method = 'webshare-url';
                } else {
                    // Copia negli appunti
                    result.success = await this.copyToClipboard(url);
                    result.method = 'clipboard';
                }

                return result;
            } catch (error) {
                console.error('Errore creazione link condivisione:', error);
            }
        }

        // Ultimo fallback: download
        if (blob) {
            const filename = item.name + (item.type === 'note' ? '.md' : '');
            this.downloadFile(blob, filename);
            result.method = 'download';
            result.success = true;
        }

        return result;
    }
}

export default ShareService;
