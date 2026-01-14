/**
 * Parser Markdown leggero per Scripta Manent
 * Supporta sintassi comune senza dipendenze esterne
 */

/**
 * Converte Markdown in HTML
 * @param {string} markdown - Testo Markdown
 * @returns {string} - HTML generato
 */
export function parseMarkdown(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // Escape HTML per sicurezza
    html = escapeHtml(html);

    // Blocchi di codice (``` code ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Codice inline (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers (# ## ### etc)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Linee orizzontali (--- o ***)
    html = html.replace(/^([-*_]){3,}\s*$/gm, '<hr>');

    // Blockquote (> text)
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    // Unisci blockquote consecutive
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

    // Liste non ordinate (- item o * item)
    html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');

    // Liste ordinate (1. item)
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Raggruppa li in ul/ol (semplificato)
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        return '<ul>' + match + '</ul>';
    });

    // Immagini ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');

    // Link [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Bold (**text** o __text__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic (*text* o _text_)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Strikethrough (~~text~~)
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Checkbox [ ] e [x]
    html = html.replace(/\[ \]/g, '<input type="checkbox" disabled>');
    html = html.replace(/\[x\]/gi, '<input type="checkbox" checked disabled>');

    // Paragrafi (linee vuote separano i paragrafi)
    html = html.split(/\n\n+/).map(block => {
        // Non wrappare se è già un elemento block
        if (block.match(/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|div)/)) {
            return block;
        }
        return `<p>${block}</p>`;
    }).join('\n');

    // Newline singoli in <br> all'interno dei paragrafi
    html = html.replace(/<p>([^<]*)\n([^<]*)<\/p>/g, '<p>$1<br>$2</p>');

    return html;
}

/**
 * Escape caratteri HTML speciali
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Estrae il testo puro da Markdown (rimuove formattazione)
 * @param {string} markdown
 * @returns {string}
 */
export function stripMarkdown(markdown) {
    if (!markdown) return '';

    let text = markdown;

    // Rimuovi blocchi di codice
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]+`/g, '');

    // Rimuovi headers
    text = text.replace(/^#{1,6}\s+/gm, '');

    // Rimuovi bold/italic
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/_([^_]+)_/g, '$1');

    // Rimuovi strikethrough
    text = text.replace(/~~([^~]+)~~/g, '$1');

    // Rimuovi link, mantieni testo
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Rimuovi immagini
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

    // Rimuovi blockquote
    text = text.replace(/^>\s+/gm, '');

    // Rimuovi liste
    text = text.replace(/^[\-\*]\s+/gm, '');
    text = text.replace(/^\d+\.\s+/gm, '');

    // Rimuovi linee orizzontali
    text = text.replace(/^([-*_]){3,}\s*$/gm, '');

    // Normalizza spazi
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
}

/**
 * Estrae il primo heading dal markdown
 * @param {string} markdown
 * @returns {string|null}
 */
export function extractTitle(markdown) {
    if (!markdown) return null;

    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
}

/**
 * Estrae un'anteprima del contenuto (prime N parole)
 * @param {string} markdown
 * @param {number} [maxWords=50]
 * @returns {string}
 */
export function extractPreview(markdown, maxWords = 50) {
    const text = stripMarkdown(markdown);
    const words = text.split(/\s+/).filter(w => w.length > 0);

    if (words.length <= maxWords) {
        return text;
    }

    return words.slice(0, maxWords).join(' ') + '...';
}

/**
 * Conta le parole nel testo markdown
 * @param {string} markdown
 * @returns {number}
 */
export function countWords(markdown) {
    const text = stripMarkdown(markdown);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return words.length;
}

/**
 * Conta i caratteri nel testo markdown
 * @param {string} markdown
 * @returns {number}
 */
export function countCharacters(markdown) {
    const text = stripMarkdown(markdown);
    return text.length;
}

/**
 * Inserisce formattazione markdown
 * @param {string} text - Il testo selezionato
 * @param {string} format - Tipo di formattazione ('bold', 'italic', 'code', etc.)
 * @returns {string}
 */
export function applyFormat(text, format) {
    switch (format) {
        case 'bold':
            return `**${text}**`;
        case 'italic':
            return `*${text}*`;
        case 'strikethrough':
            return `~~${text}~~`;
        case 'code':
            return `\`${text}\``;
        case 'codeblock':
            return `\`\`\`\n${text}\n\`\`\``;
        case 'link':
            return `[${text}](url)`;
        case 'image':
            return `![${text}](url)`;
        case 'quote':
            return text.split('\n').map(line => `> ${line}`).join('\n');
        case 'h1':
            return `# ${text}`;
        case 'h2':
            return `## ${text}`;
        case 'h3':
            return `### ${text}`;
        case 'ul':
            return text.split('\n').map(line => `- ${line}`).join('\n');
        case 'ol':
            return text.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
        case 'checkbox':
            return `[ ] ${text}`;
        case 'hr':
            return `---`;
        default:
            return text;
    }
}

export default {
    parseMarkdown,
    escapeHtml,
    stripMarkdown,
    extractTitle,
    extractPreview,
    countWords,
    countCharacters,
    applyFormat
};
