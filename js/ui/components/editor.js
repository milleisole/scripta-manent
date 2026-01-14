/**
 * Componente Editor Markdown per Scripta Manent
 * Editor con preview e toolbar
 */

import { parseMarkdown, applyFormat, countWords, countCharacters } from '../../utils/markdown.js';
import { debounce } from '../../config.js';

/**
 * Classe per l'editor di note Markdown
 */
export class Editor {
    /**
     * @param {HTMLElement} container - Container dell'editor
     * @param {Object} options - Opzioni
     */
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            autoSave: true,
            autoSaveDelay: 2000,
            showPreview: false,
            onSave: null,
            onChange: null,
            ...options
        };

        this.note = null;
        this.isDirty = false;
        this.isSaving = false;

        this.init();
    }

    /**
     * Inizializza l'editor
     */
    init() {
        this.render();
        this.setupEventListeners();
    }

    /**
     * Renderizza l'editor
     */
    render() {
        this.container.innerHTML = `
            <div class="editor-container">
                <div class="editor-header">
                    <input type="text" class="editor-title-input" placeholder="Titolo della nota...">
                    <div class="editor-actions">
                        <button class="icon-btn" data-action="encrypt" title="Cifra/Decifra">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0110 0v4"/>
                            </svg>
                        </button>
                        <button class="icon-btn" data-action="tags" title="Tag">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                                <line x1="7" y1="7" x2="7.01" y2="7"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="editor-toolbar">
                    <button class="toolbar-btn" data-format="bold" title="Grassetto (Ctrl+B)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/>
                            <path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="italic" title="Corsivo (Ctrl+I)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="19" y1="4" x2="10" y2="4"/>
                            <line x1="14" y1="20" x2="5" y2="20"/>
                            <line x1="15" y1="4" x2="9" y2="20"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="strikethrough" title="Barrato">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 4H9a3 3 0 00-3 3v1a3 3 0 003 3h6a3 3 0 013 3v1a3 3 0 01-3 3H5"/>
                            <line x1="4" y1="12" x2="20" y2="12"/>
                        </svg>
                    </button>
                    <div class="toolbar-divider"></div>
                    <button class="toolbar-btn" data-format="h1" title="Titolo H1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 12h8"/>
                            <path d="M4 18V6"/>
                            <path d="M12 18V6"/>
                            <path d="M17 10v8"/>
                            <path d="M21 10v8"/>
                            <path d="M21 14h-4"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="h2" title="Titolo H2">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 12h8"/>
                            <path d="M4 18V6"/>
                            <path d="M12 18V6"/>
                            <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="h3" title="Titolo H3">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 12h8"/>
                            <path d="M4 18V6"/>
                            <path d="M12 18V6"/>
                            <path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 01-2 2"/>
                            <path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 00-2-2"/>
                        </svg>
                    </button>
                    <div class="toolbar-divider"></div>
                    <button class="toolbar-btn" data-format="ul" title="Lista puntata">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="8" y1="6" x2="21" y2="6"/>
                            <line x1="8" y1="12" x2="21" y2="12"/>
                            <line x1="8" y1="18" x2="21" y2="18"/>
                            <line x1="3" y1="6" x2="3.01" y2="6"/>
                            <line x1="3" y1="12" x2="3.01" y2="12"/>
                            <line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="ol" title="Lista numerata">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="10" y1="6" x2="21" y2="6"/>
                            <line x1="10" y1="12" x2="21" y2="12"/>
                            <line x1="10" y1="18" x2="21" y2="18"/>
                            <path d="M4 6h1v4"/>
                            <path d="M4 10h2"/>
                            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="checkbox" title="Checkbox">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <path d="M9 12l2 2 4-4"/>
                        </svg>
                    </button>
                    <div class="toolbar-divider"></div>
                    <button class="toolbar-btn" data-format="link" title="Link (Ctrl+K)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="code" title="Codice inline">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16,18 22,12 16,6"/>
                            <polyline points="8,6 2,12 8,18"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="codeblock" title="Blocco codice">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <polyline points="9,9 6,12 9,15"/>
                            <polyline points="15,9 18,12 15,15"/>
                        </svg>
                    </button>
                    <button class="toolbar-btn" data-format="quote" title="Citazione">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/>
                            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
                        </svg>
                    </button>
                    <div class="toolbar-divider"></div>
                    <button class="toolbar-btn" data-action="preview" title="Anteprima (Ctrl+P)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                </div>

                <div class="editor-content">
                    <textarea class="editor-textarea" placeholder="Inizia a scrivere..."></textarea>
                    <div class="editor-preview markdown-body"></div>
                </div>

                <div class="editor-status">
                    <div class="editor-status-saved">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                            <polyline points="22,4 12,14.01 9,11.01"/>
                        </svg>
                        <span class="status-text">Salvato</span>
                    </div>
                    <div class="editor-word-count">
                        <span class="word-count">0</span> parole · <span class="char-count">0</span> caratteri
                    </div>
                </div>
            </div>
        `;

        // Riferimenti elementi
        this.titleInput = this.container.querySelector('.editor-title-input');
        this.textarea = this.container.querySelector('.editor-textarea');
        this.preview = this.container.querySelector('.editor-preview');
        this.statusText = this.container.querySelector('.status-text');
        this.statusIcon = this.container.querySelector('.editor-status-saved');
        this.wordCountEl = this.container.querySelector('.word-count');
        this.charCountEl = this.container.querySelector('.char-count');
        this.previewBtn = this.container.querySelector('[data-action="preview"]');
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Cambio testo
        this.textarea.addEventListener('input', () => {
            this.isDirty = true;
            this.updateWordCount();
            this.updatePreview();

            if (this.options.onChange) {
                this.options.onChange(this.getContent());
            }

            if (this.options.autoSave) {
                this.debouncedSave();
            }
        });

        // Cambio titolo
        this.titleInput.addEventListener('input', () => {
            this.isDirty = true;
            if (this.options.autoSave) {
                this.debouncedSave();
            }
        });

        // Toolbar
        this.container.querySelectorAll('.toolbar-btn[data-format]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyFormat(btn.dataset.format);
            });
        });

        // Azioni
        this.container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleAction(btn.dataset.action);
            });
        });

        // Scorciatoie da tastiera
        this.textarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.applyFormat('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.applyFormat('italic');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.applyFormat('link');
                        break;
                    case 's':
                        e.preventDefault();
                        this.save();
                        break;
                }
            }
        });

        // Tab per indentazione
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                const value = this.textarea.value;
                this.textarea.value = value.substring(0, start) + '    ' + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
                this.textarea.dispatchEvent(new Event('input'));
            }
        });

        // Debounce save
        this.debouncedSave = debounce(() => this.save(), this.options.autoSaveDelay);
    }

    /**
     * Carica una nota nell'editor
     * @param {Object} note
     */
    load(note) {
        this.note = note;
        this.titleInput.value = note.name || '';
        this.textarea.value = note.content || '';
        this.isDirty = false;
        this.updateWordCount();
        this.updatePreview();
        this.updateStatus('saved');
    }

    /**
     * Ottiene il contenuto attuale
     * @returns {Object}
     */
    getContent() {
        return {
            name: this.titleInput.value,
            content: this.textarea.value
        };
    }

    /**
     * Salva la nota
     */
    async save() {
        if (!this.isDirty || this.isSaving) return;

        this.isSaving = true;
        this.updateStatus('saving');

        try {
            if (this.note) {
                this.note.name = this.titleInput.value || 'Senza titolo';
                this.note.content = this.textarea.value;
            }

            if (this.options.onSave) {
                await this.options.onSave(this.getContent(), this.note);
            }

            this.isDirty = false;
            this.updateStatus('saved');
        } catch (error) {
            console.error('Errore salvataggio:', error);
            this.updateStatus('error');
        } finally {
            this.isSaving = false;
        }
    }

    /**
     * Applica formattazione al testo selezionato
     * @param {string} format
     */
    applyFormat(format) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const selectedText = this.textarea.value.substring(start, end) || 'testo';

        const formatted = applyFormat(selectedText, format);

        const before = this.textarea.value.substring(0, start);
        const after = this.textarea.value.substring(end);

        this.textarea.value = before + formatted + after;

        // Riposiziona cursore
        this.textarea.focus();
        const newCursorPos = start + formatted.length;
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);

        this.textarea.dispatchEvent(new Event('input'));
    }

    /**
     * Gestisce le azioni dei pulsanti
     * @param {string} action
     */
    handleAction(action) {
        switch (action) {
            case 'preview':
                this.togglePreview();
                break;
            case 'encrypt':
                if (this.onEncrypt) this.onEncrypt();
                break;
            case 'tags':
                if (this.onTags) this.onTags();
                break;
        }
    }

    /**
     * Toggle preview
     */
    togglePreview() {
        this.options.showPreview = !this.options.showPreview;

        if (this.options.showPreview) {
            this.preview.classList.add('active');
            this.previewBtn.classList.add('active');
            this.updatePreview();
        } else {
            this.preview.classList.remove('active');
            this.previewBtn.classList.remove('active');
        }
    }

    /**
     * Aggiorna la preview
     */
    updatePreview() {
        if (this.options.showPreview) {
            this.preview.innerHTML = parseMarkdown(this.textarea.value);
        }
    }

    /**
     * Aggiorna conteggio parole
     */
    updateWordCount() {
        const text = this.textarea.value;
        this.wordCountEl.textContent = countWords(text);
        this.charCountEl.textContent = countCharacters(text);
    }

    /**
     * Aggiorna stato di salvataggio
     * @param {string} status - 'saved', 'saving', 'error'
     */
    updateStatus(status) {
        switch (status) {
            case 'saved':
                this.statusText.textContent = 'Salvato';
                this.statusIcon.classList.remove('editor-status-saving');
                break;
            case 'saving':
                this.statusText.textContent = 'Salvataggio...';
                this.statusIcon.classList.add('editor-status-saving');
                break;
            case 'error':
                this.statusText.textContent = 'Errore salvataggio';
                this.statusIcon.classList.remove('editor-status-saving');
                break;
        }
    }

    /**
     * Focus sull'editor
     */
    focus() {
        this.textarea.focus();
    }

    /**
     * Pulisce l'editor
     */
    clear() {
        this.note = null;
        this.titleInput.value = '';
        this.textarea.value = '';
        this.isDirty = false;
        this.updateWordCount();
        this.updatePreview();
    }

    /**
     * Distrugge l'editor
     */
    destroy() {
        this.container.innerHTML = '';
    }
}

export default Editor;
