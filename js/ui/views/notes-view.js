/**
 * Notes View per Scripta Manent
 * Lista e gestione note
 */

import { formatDate } from '../../config.js';

/**
 * View delle note
 */
export class NotesView {
    constructor(app) {
        this.app = app;
        this.notes = [];
        this.filterTag = null;
        this.sortBy = 'updated';
        this.sortOrder = 'desc';
    }

    /**
     * Renderizza la view
     */
    async render() {
        this.notes = await this.loadNotes();

        return `
            <div class="view notes-view">
                <div class="view-header">
                    <div>
                        <h1 class="view-title">Note</h1>
                        <p class="view-subtitle">${this.notes.length} note totali</p>
                    </div>
                    <button class="btn btn-primary" data-action="new-note">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Nuova nota
                    </button>
                </div>

                <div class="notes-filters" style="display: flex; gap: var(--space-md); margin-bottom: var(--space-lg); flex-wrap: wrap;">
                    <select class="form-input" style="width: auto;" id="sort-select">
                        <option value="updated-desc" ${this.sortBy === 'updated' && this.sortOrder === 'desc' ? 'selected' : ''}>Più recenti</option>
                        <option value="updated-asc" ${this.sortBy === 'updated' && this.sortOrder === 'asc' ? 'selected' : ''}>Meno recenti</option>
                        <option value="name-asc" ${this.sortBy === 'name' && this.sortOrder === 'asc' ? 'selected' : ''}>Nome A-Z</option>
                        <option value="name-desc" ${this.sortBy === 'name' && this.sortOrder === 'desc' ? 'selected' : ''}>Nome Z-A</option>
                    </select>
                    ${this.renderTagsFilter()}
                </div>

                <div class="notes-grid" id="notes-list">
                    ${this.renderNotesList()}
                </div>
            </div>
        `;
    }

    /**
     * Renderizza il filtro tag
     */
    renderTagsFilter() {
        const allTags = new Set();
        this.notes.forEach(note => {
            note.tags?.forEach(tag => allTags.add(tag));
        });

        if (allTags.size === 0) return '';

        return `
            <select class="form-input" style="width: auto;" id="tag-filter">
                <option value="">Tutti i tag</option>
                ${Array.from(allTags).map(tag => `
                    <option value="${tag}" ${this.filterTag === tag ? 'selected' : ''}>#${tag}</option>
                `).join('')}
            </select>
        `;
    }

    /**
     * Renderizza la lista note
     */
    renderNotesList() {
        let filtered = this.notes;

        // Filtra per tag
        if (this.filterTag) {
            filtered = filtered.filter(n => n.tags?.includes(this.filterTag));
        }

        // Ordina
        filtered.sort((a, b) => {
            const aVal = a[this.sortBy];
            const bVal = b[this.sortBy];
            const order = this.sortOrder === 'desc' ? -1 : 1;
            return aVal > bVal ? order : -order;
        });

        if (filtered.length === 0) {
            return `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <div class="empty-state-title">Nessuna nota</div>
                    <p class="empty-state-text">Crea la tua prima nota per iniziare</p>
                    <button class="btn btn-primary" data-action="new-note" style="margin-top: var(--space-md);">
                        Crea nota
                    </button>
                </div>
            `;
        }

        return filtered.map(note => `
            <div class="card card-clickable note-card" data-note-id="${note.id}">
                <div class="note-card-title">${this.escapeHtml(note.name)}</div>
                <div class="note-card-preview">${this.escapeHtml(note.getPreview ? note.getPreview() : '')}</div>
                <div class="note-card-meta">
                    <span>${formatDate(note.updated)}</span>
                    ${note.encrypted ? `
                        <span class="tag tag-encrypted">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0110 0v4"/>
                            </svg>
                            Cifrato
                        </span>
                    ` : ''}
                </div>
                ${note.tags?.length > 0 ? `
                    <div class="note-card-tags">
                        ${note.tags.map(tag => `<span class="tag" data-tag="${tag}">#${tag}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="card-actions" style="position: absolute; top: var(--space-sm); right: var(--space-sm);">
                    <button class="icon-btn icon-btn-small" data-action="delete-note" data-id="${note.id}" title="Elimina">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Carica le note
     */
    async loadNotes() {
        try {
            if (!this.app.notesService) return [];
            return await this.app.notesService.list();
        } catch (error) {
            console.error('Errore caricamento note:', error);
            return [];
        }
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Click su nota
        document.querySelectorAll('[data-note-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]')) return;
                if (e.target.closest('[data-tag]')) return;
                window.location.hash = `#/notes/${card.dataset.noteId}`;
            });
        });

        // Click su tag
        document.querySelectorAll('[data-tag]').forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.stopPropagation();
                this.filterTag = tag.dataset.tag;
                this.refresh();
            });
        });

        // Nuova nota
        document.querySelectorAll('[data-action="new-note"]').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.hash = '#/notes/new';
            });
        });

        // Elimina nota
        document.querySelectorAll('[data-action="delete-note"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const confirmed = await this.app.modal.confirm(
                    'Elimina nota',
                    'Sei sicuro di voler eliminare questa nota?',
                    { danger: true }
                );
                if (confirmed) {
                    await this.app.deleteNote(id);
                    this.refresh();
                }
            });
        });

        // Ordinamento
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const [sortBy, sortOrder] = sortSelect.value.split('-');
                this.sortBy = sortBy;
                this.sortOrder = sortOrder;
                this.updateList();
            });
        }

        // Filtro tag
        const tagFilter = document.getElementById('tag-filter');
        if (tagFilter) {
            tagFilter.addEventListener('change', () => {
                this.filterTag = tagFilter.value || null;
                this.updateList();
            });
        }
    }

    /**
     * Aggiorna solo la lista
     */
    updateList() {
        const container = document.getElementById('notes-list');
        if (container) {
            container.innerHTML = this.renderNotesList();
            this.setupEventListeners();
        }
    }

    /**
     * Refresh completo
     */
    async refresh() {
        this.notes = await this.loadNotes();
        this.updateList();
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

export default NotesView;
