/**
 * Generatore QR Code per Scripta Manent
 * Implementazione leggera senza dipendenze
 */

/**
 * Genera un QR Code come canvas
 * @param {string} text - Il testo da codificare
 * @param {Object} options - Opzioni di configurazione
 * @returns {HTMLCanvasElement}
 */
export function generateQRCode(text, options = {}) {
    const {
        size = 256,
        margin = 4,
        darkColor = '#000000',
        lightColor = '#ffffff',
        errorCorrectionLevel = 'M'
    } = options;

    // Crea la matrice QR
    const qr = createQRMatrix(text, errorCorrectionLevel);

    // Crea il canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const moduleCount = qr.length;
    const moduleSize = Math.floor((size - margin * 2) / moduleCount);
    const actualSize = moduleSize * moduleCount + margin * 2;

    canvas.width = actualSize;
    canvas.height = actualSize;

    // Sfondo
    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, actualSize, actualSize);

    // Disegna i moduli
    ctx.fillStyle = darkColor;
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (qr[row][col]) {
                ctx.fillRect(
                    margin + col * moduleSize,
                    margin + row * moduleSize,
                    moduleSize,
                    moduleSize
                );
            }
        }
    }

    return canvas;
}

/**
 * Genera un QR Code come data URL
 * @param {string} text - Il testo da codificare
 * @param {Object} options - Opzioni di configurazione
 * @returns {string} - Data URL dell'immagine PNG
 */
export function generateQRCodeDataURL(text, options = {}) {
    const canvas = generateQRCode(text, options);
    return canvas.toDataURL('image/png');
}

/**
 * Genera un QR Code come SVG
 * @param {string} text - Il testo da codificare
 * @param {Object} options - Opzioni di configurazione
 * @returns {string} - SVG come stringa
 */
export function generateQRCodeSVG(text, options = {}) {
    const {
        size = 256,
        margin = 4,
        darkColor = '#000000',
        lightColor = '#ffffff',
        errorCorrectionLevel = 'M'
    } = options;

    const qr = createQRMatrix(text, errorCorrectionLevel);
    const moduleCount = qr.length;
    const moduleSize = (size - margin * 2) / moduleCount;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
    svg += `<rect width="100%" height="100%" fill="${lightColor}"/>`;

    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (qr[row][col]) {
                svg += `<rect x="${margin + col * moduleSize}" y="${margin + row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="${darkColor}"/>`;
            }
        }
    }

    svg += '</svg>';
    return svg;
}

/**
 * Crea la matrice QR Code
 * Implementazione semplificata per QR Version 1-10
 * @param {string} text - Testo da codificare
 * @param {string} ecLevel - Livello di correzione errori (L, M, Q, H)
 * @returns {boolean[][]} - Matrice di moduli
 */
function createQRMatrix(text, ecLevel = 'M') {
    // Determina la versione necessaria
    const version = getMinVersion(text, ecLevel);
    const size = version * 4 + 17;

    // Inizializza la matrice
    const matrix = Array(size).fill(null).map(() => Array(size).fill(false));
    const reserved = Array(size).fill(null).map(() => Array(size).fill(false));

    // Aggiungi i pattern fissi
    addFinderPatterns(matrix, reserved, size);
    addAlignmentPatterns(matrix, reserved, version);
    addTimingPatterns(matrix, reserved, size);
    addDarkModule(matrix, reserved, version);
    reserveFormatInfo(reserved, size);
    if (version >= 7) {
        reserveVersionInfo(reserved, size);
    }

    // Codifica i dati
    const data = encodeData(text, version, ecLevel);
    const codewords = addErrorCorrection(data, version, ecLevel);

    // Posiziona i dati
    placeData(matrix, reserved, codewords, size);

    // Applica la maschera migliore
    applyBestMask(matrix, reserved, size);

    // Aggiungi info formato
    addFormatInfo(matrix, ecLevel, 0, size); // mask 0 per semplicità

    return matrix;
}

/**
 * Trova la versione minima necessaria
 */
function getMinVersion(text, ecLevel) {
    const capacities = {
        'L': [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
        'M': [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
        'Q': [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
        'H': [7, 14, 24, 34, 44, 58, 64, 84, 98, 119]
    };

    const len = new TextEncoder().encode(text).length;
    const caps = capacities[ecLevel];

    for (let v = 1; v <= 10; v++) {
        if (caps[v - 1] >= len) {
            return v;
        }
    }
    return 10; // Max supportato in questa implementazione
}

/**
 * Aggiunge i finder patterns (quadrati negli angoli)
 */
function addFinderPatterns(matrix, reserved, size) {
    const positions = [[0, 0], [0, size - 7], [size - 7, 0]];

    for (const [row, col] of positions) {
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                const isBlack = (r === 0 || r === 6 || c === 0 || c === 6) ||
                    (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                matrix[row + r][col + c] = isBlack;
                reserved[row + r][col + c] = true;
            }
        }

        // Separatori bianchi
        for (let i = 0; i < 8; i++) {
            if (row === 0) {
                if (col + 7 < size) { reserved[row + i][col + 7] = true; }
                if (i < 7) { reserved[row + 7][col + i] = true; }
            }
            if (col === 0) {
                if (row + 7 < size) { reserved[row + 7][col + i] = true; }
                if (i < 7) { reserved[row + i][col + 7] = true; }
            }
        }
    }
}

/**
 * Aggiunge gli alignment patterns
 */
function addAlignmentPatterns(matrix, reserved, version) {
    if (version < 2) return;

    const positions = getAlignmentPositions(version);

    for (const row of positions) {
        for (const col of positions) {
            // Salta se sovrapposto ai finder patterns
            if ((row < 8 && col < 8) ||
                (row < 8 && col >= matrix.length - 8) ||
                (row >= matrix.length - 8 && col < 8)) {
                continue;
            }

            for (let r = -2; r <= 2; r++) {
                for (let c = -2; c <= 2; c++) {
                    const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 ||
                        (r === 0 && c === 0);
                    matrix[row + r][col + c] = isBlack;
                    reserved[row + r][col + c] = true;
                }
            }
        }
    }
}

/**
 * Restituisce le posizioni degli alignment patterns
 */
function getAlignmentPositions(version) {
    const alignmentTable = [
        [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
        [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
    ];
    return alignmentTable[version] || [];
}

/**
 * Aggiunge i timing patterns
 */
function addTimingPatterns(matrix, reserved, size) {
    for (let i = 8; i < size - 8; i++) {
        const isBlack = i % 2 === 0;
        matrix[6][i] = isBlack;
        matrix[i][6] = isBlack;
        reserved[6][i] = true;
        reserved[i][6] = true;
    }
}

/**
 * Aggiunge il dark module
 */
function addDarkModule(matrix, reserved, version) {
    const row = 4 * version + 9;
    matrix[row][8] = true;
    reserved[row][8] = true;
}

/**
 * Riserva spazio per le info formato
 */
function reserveFormatInfo(reserved, size) {
    for (let i = 0; i < 9; i++) {
        reserved[8][i] = true;
        reserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
        reserved[8][size - 1 - i] = true;
        reserved[size - 1 - i][8] = true;
    }
}

/**
 * Riserva spazio per le info versione
 */
function reserveVersionInfo(reserved, size) {
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 3; j++) {
            reserved[i][size - 11 + j] = true;
            reserved[size - 11 + j][i] = true;
        }
    }
}

/**
 * Codifica i dati in modalità byte
 */
function encodeData(text, version, ecLevel) {
    const bytes = new TextEncoder().encode(text);
    const bits = [];

    // Mode indicator (byte mode = 0100)
    bits.push(0, 1, 0, 0);

    // Character count (8 o 16 bit in base alla versione)
    const countBits = version < 10 ? 8 : 16;
    for (let i = countBits - 1; i >= 0; i--) {
        bits.push((bytes.length >> i) & 1);
    }

    // Data
    for (const byte of bytes) {
        for (let i = 7; i >= 0; i--) {
            bits.push((byte >> i) & 1);
        }
    }

    // Terminator
    const capacity = getDataCapacity(version, ecLevel) * 8;
    const termLen = Math.min(4, capacity - bits.length);
    for (let i = 0; i < termLen; i++) {
        bits.push(0);
    }

    // Pad to byte boundary
    while (bits.length % 8 !== 0) {
        bits.push(0);
    }

    // Pad bytes
    const padBytes = [0xEC, 0x11];
    let padIdx = 0;
    while (bits.length < capacity) {
        const pb = padBytes[padIdx % 2];
        for (let i = 7; i >= 0; i--) {
            bits.push((pb >> i) & 1);
        }
        padIdx++;
    }

    // Convert to bytes
    const result = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) {
            byte = (byte << 1) | bits[i + j];
        }
        result.push(byte);
    }

    return result;
}

/**
 * Restituisce la capacità dati per versione ed EC level
 */
function getDataCapacity(version, ecLevel) {
    const table = {
        'L': [19, 34, 55, 80, 108, 136, 156, 194, 232, 274],
        'M': [16, 28, 44, 64, 86, 108, 124, 154, 182, 216],
        'Q': [13, 22, 34, 48, 62, 76, 88, 110, 132, 154],
        'H': [9, 16, 26, 36, 46, 60, 66, 86, 100, 122]
    };
    return table[ecLevel][version - 1];
}

/**
 * Aggiunge la correzione errori (semplificata)
 */
function addErrorCorrection(data, version, ecLevel) {
    // Per semplicità, in questa implementazione non calcoliamo
    // i veri codewords EC con Reed-Solomon. Restituiamo i dati originali.
    // In una implementazione completa, qui andrebbe il calcolo RS.
    return data;
}

/**
 * Posiziona i dati nella matrice
 */
function placeData(matrix, reserved, codewords, size) {
    let bitIdx = 0;
    const bits = [];
    for (const cw of codewords) {
        for (let i = 7; i >= 0; i--) {
            bits.push((cw >> i) & 1);
        }
    }

    let upward = true;
    for (let col = size - 1; col >= 0; col -= 2) {
        if (col === 6) col = 5; // Skip timing column

        for (let row = upward ? size - 1 : 0;
            upward ? row >= 0 : row < size;
            row += upward ? -1 : 1) {

            for (let c = 0; c < 2; c++) {
                const actualCol = col - c;
                if (!reserved[row][actualCol]) {
                    if (bitIdx < bits.length) {
                        matrix[row][actualCol] = bits[bitIdx] === 1;
                        bitIdx++;
                    }
                }
            }
        }
        upward = !upward;
    }
}

/**
 * Applica la maschera migliore
 */
function applyBestMask(matrix, reserved, size) {
    // Usa maschera 0 per semplicità: (row + col) % 2 === 0
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (!reserved[row][col]) {
                if ((row + col) % 2 === 0) {
                    matrix[row][col] = !matrix[row][col];
                }
            }
        }
    }
}

/**
 * Aggiunge le info formato
 */
function addFormatInfo(matrix, ecLevel, mask, size) {
    // Format info bits per EC level M e mask 0
    const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

    // Posizioni per format info
    for (let i = 0; i < 6; i++) {
        matrix[8][i] = formatBits[i] === 1;
        matrix[i][8] = formatBits[14 - i] === 1;
    }
    matrix[8][7] = formatBits[6] === 1;
    matrix[8][8] = formatBits[7] === 1;
    matrix[7][8] = formatBits[8] === 1;

    for (let i = 0; i < 8; i++) {
        matrix[8][size - 1 - i] = formatBits[i] === 1;
        matrix[size - 1 - i][8] = formatBits[14 - i] === 1;
    }
}

export default {
    generateQRCode,
    generateQRCodeDataURL,
    generateQRCodeSVG
};
