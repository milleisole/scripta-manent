/**
 * Componente Toast per Scripta Manent
 * Notifiche temporanee
 */

/**
 * Classe per la gestione delle notifiche toast
 */
export class Toast {
    constructor() {
        this.container = document.getElementById('toast-container');
        this.toasts = [];
        this.defaultDuration = 4000;
    }

    /**
     * Mostra una notifica toast
     * @param {Object} options - Opzioni del toast
     * @returns {Object} - Riferimento al toast creato
     */
    show(options = {}) {
        const {
            type = 'info', // 'success', 'error', 'warning', 'info'
            title = '',
            message = '',
            duration = this.defaultDuration,
            closable = true,
            action = null // { text: 'Undo', callback: () => {} }
        } = options;

        // Crea elemento toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Icona
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        icon.innerHTML = this.getIcon(type);
        toast.appendChild(icon);

        // Contenuto
        const content = document.createElement('div');
        content.className = 'toast-content';

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }

        if (message) {
            const messageEl = document.createElement('div');
            messageEl.className = 'toast-message';
            messageEl.textContent = message;
            content.appendChild(messageEl);
        }

        toast.appendChild(content);

        // Azione
        if (action) {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'btn btn-sm btn-ghost';
            actionBtn.textContent = action.text;
            actionBtn.onclick = () => {
                action.callback();
                this.dismiss(toastRef);
            };
            toast.appendChild(actionBtn);
        }

        // Pulsante chiudi
        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            `;
            closeBtn.onclick = () => this.dismiss(toastRef);
            toast.appendChild(closeBtn);
        }

        // Aggiungi al container
        this.container.appendChild(toast);

        // Crea riferimento
        const toastRef = {
            element: toast,
            timeout: null
        };

        this.toasts.push(toastRef);

        // Auto-dismiss dopo duration
        if (duration > 0) {
            toastRef.timeout = setTimeout(() => {
                this.dismiss(toastRef);
            }, duration);
        }

        return toastRef;
    }

    /**
     * Chiude un toast
     * @param {Object} toastRef - Riferimento al toast
     */
    dismiss(toastRef) {
        if (!toastRef || !toastRef.element) return;

        // Cancella timeout
        if (toastRef.timeout) {
            clearTimeout(toastRef.timeout);
        }

        // Animazione di uscita
        toastRef.element.classList.add('removing');

        setTimeout(() => {
            if (toastRef.element.parentNode) {
                toastRef.element.parentNode.removeChild(toastRef.element);
            }

            // Rimuovi dalla lista
            const index = this.toasts.indexOf(toastRef);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 250);
    }

    /**
     * Chiude tutti i toast
     */
    dismissAll() {
        [...this.toasts].forEach(toast => this.dismiss(toast));
    }

    /**
     * Mostra toast di successo
     * @param {string} message
     * @param {string} [title]
     */
    success(message, title = '') {
        return this.show({ type: 'success', title, message });
    }

    /**
     * Mostra toast di errore
     * @param {string} message
     * @param {string} [title]
     */
    error(message, title = '') {
        return this.show({
            type: 'error',
            title: title || 'Errore',
            message,
            duration: 6000
        });
    }

    /**
     * Mostra toast di warning
     * @param {string} message
     * @param {string} [title]
     */
    warning(message, title = '') {
        return this.show({ type: 'warning', title, message });
    }

    /**
     * Mostra toast informativo
     * @param {string} message
     * @param {string} [title]
     */
    info(message, title = '') {
        return this.show({ type: 'info', title, message });
    }

    /**
     * Mostra toast con azione (es. Undo)
     * @param {string} message
     * @param {string} actionText
     * @param {Function} actionCallback
     */
    withAction(message, actionText, actionCallback) {
        return this.show({
            type: 'info',
            message,
            duration: 8000,
            action: {
                text: actionText,
                callback: actionCallback
            }
        });
    }

    /**
     * Ottiene l'icona SVG per il tipo di toast
     * @param {string} type
     * @returns {string}
     */
    getIcon(type) {
        const icons = {
            success: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
            `,
            error: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            `,
            warning: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            `,
            info: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
            `
        };

        return icons[type] || icons.info;
    }
}

// Istanza singleton
let toastInstance = null;

export function getToast() {
    if (!toastInstance) {
        toastInstance = new Toast();
    }
    return toastInstance;
}

export default Toast;
