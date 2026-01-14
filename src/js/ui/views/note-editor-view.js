/**
 * Note Editor View per Scripta Manent
 * Editor singola nota
 */

import { Editor } from '../components/editor.js';
import { Note } from '../../models/note.js';

/**
 * View dell'editor nota
 */
export class NoteEditorView {
    constructor(app) {
        this.app = app;
        this.editor = null;
        this.note = null;
        this.isNew = false;
    }

    /**
     * Renderizza la view
     * @param {string} noteId - ID della nota o 'new'
     */
    async render(noteId) {
        this.isNew = noteId === 'new';

        if (this.isNew) {
            this.note = new Note({ name: '', content: '' });
        } else {
            this.note = await this.loadNote(noteId);
            if (!this.note) {
                return `
                    <div class="view">
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                            <div class="empty-state-title">Nota non trovata</div>
                            <a href="#/notes" class="btn btn-primary" style="margin-top: var(--space-md);">
                                Torna alle note
                            </a>
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="view note-editor-view">
                <div class="editor-view-header" style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md);">
                    <a href="#/notes" class="icon-btn" title="Indietro">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </a>
                    <div style="flex: 1;"></div>
                    <button class="icon-btn" id="share-note-btn" title="Condividi">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                    </button>
                    <button class="icon-btn" id="delete-note-btn" title="Elimina">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
                <div id="editor-container"></div>
            </div>
        `;
    }

    /**
     * Carica una nota
     */
    async loadNote(noteId) {
        try {
            if (!this.app.notesService) return null;
            return await this.app.notesService.get(noteId);
        } catch (error) {
            console.error('Errore caricamento nota:', error);
            return null;
        }
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        const container = document.getElementById('editor-container');
        if (!container || !this.note) return;

        // Inizializza editor
        this.editor = new Editor(container, {
            autoSave: true,
            autoSaveDelay: 2000,
            onSave: async (content, note) => {
                await this.saveNote(content, note);
            },
            onChange: (content) => {
                // Aggiorna titolo header se cambia
            }
        });

        this.editor.load(this.note);

        // Configura azioni aggiuntive
        this.editor.onEncrypt = () => this.toggleEncryption();
        this.editor.onTags = () => this.editTags();

        // Condividi
        const shareBtn = document.getElementById('share-note-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareNote());
        }

        // Elimina
        const deleteBtn = document.getElementById('delete-note-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteNote());
        }
    }

    /**
     * Salva la nota
     */
    async saveNote(content, note) {
        try {
            if (this.isNew) {
                // Crea nuova nota
                note.name = content.name || 'Senza titolo';
                note.content = content.content;

                const created = await this.app.notesService.create(note);
                this.note = created;
                this.isNew = false;

                // Aggiorna URL senza ricaricare
                history.replaceState(null, '', `#/notes/${created.id}`);

                this.app.toast.success('Nota creata');
            } else {
                // Aggiorna nota esistente
                note.name = content.name || note.name;
                note.content = content.content;

                await this.app.notesService.update(note);
            }
        } catch (error) {
            console.error('Errore salvataggio nota:', error);
            this.app.toast.error('Errore durante il salvataggio');
            throw error;
        }
    }

    /**
     * Toggle cifratura
     */
    async toggleEncryption() {
        if (!this.note || this.isNew) {
            this.app.toast.warning('Salva la nota prima di cifrarla');
            return;
        }

        if (!this.app.keyManager?.isReady()) {
            // Chiedi la password
            const password = await this.app.modal.prompt('Password richiesta', {
                message: 'Inserisci la password master per cifrare la nota',
                inputType: 'password',
                placeholder: 'Password'
            });

            if (!password) return;

            const unlocked = await this.app.keyManager.unlock(password);
            if (!unlocked) {
                this.app.toast.error('Password non corretta');
                return;
            }
        }

        try {
            const newState = !this.note.encrypted;
            await this.app.notesService.toggleEncryption(this.note.id, newState);
            this.note.encrypted = newState;

            this.app.toast.success(newState ? 'Nota cifrata' : 'Nota decifrata');
        } catch (error) {
            this.app.toast.error('Errore durante la cifratura');
        }
    }

    /**
     * Modifica tag
     */
    async editTags() {
        const currentTags = this.note?.tags?.join(', ') || '';

        const tagsString = await this.app.modal.prompt('Modifica tag', {
            message: 'Inserisci i tag separati da virgola',
            placeholder: 'tag1, tag2, tag3',
            defaultValue: currentTags
        });

        if (tagsString === null) return;

        const newTags = tagsString
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0);

        this.note.tags = newTags;

        if (!this.isNew) {
            await this.app.notesService.update(this.note, false);
            this.app.toast.success('Tag aggiornati');
        }
    }

    /**
     * Condividi nota
     */
    async shareNote() {
        if (!this.note || this.isNew) {
            this.app.toast.warning('Salva la nota prima di condividerla');
            return;
        }

        try {
            const blob = new Blob([this.note.content], { type: 'text/markdown' });
            const result = await this.app.shareService.smartShare(this.note, blob);

            if (result.method === 'clipboard') {
                this.app.toast.success('Link copiato negli appunti');
            } else if (result.method === 'download') {
                this.app.toast.success('Nota scaricata');
            }
        } catch (error) {
            this.app.toast.error('Errore durante la condivisione');
        }
    }

    /**
     * Elimina nota
     */
    async deleteNote() {
        if (this.isNew) {
            window.location.hash = '#/notes';
            return;
        }

        const confirmed = await this.app.modal.confirm(
            'Elimina nota',
            'Sei sicuro di voler eliminare questa nota?',
            { danger: true }
        );

        if (confirmed) {
            try {
                await this.app.notesService.delete(this.note.id, this.app.trashService);
                this.app.toast.success('Nota eliminata');
                window.location.hash = '#/notes';
            } catch (error) {
                this.app.toast.error('Errore durante l\'eliminazione');
            }
        }
    }

    /**
     * Cleanup quando si lascia la view
     */
    destroy() {
        if (this.editor) {
            // Salva eventuali modifiche non salvate
            if (this.editor.isDirty) {
                this.editor.save();
            }
            this.editor.destroy();
            this.editor = null;
        }
    }
}

export default NoteEditorView;
