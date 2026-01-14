/**
 * Componente Modal per Scripta Manent
 * Gestisce dialog modali riutilizzabili
 */

/**
 * Classe per la gestione dei modal
 */
export class Modal {
    constructor() {
        this.modalElement = document.getElementById('modal');
        this.backdrop = this.modalElement.querySelector('.modal-backdrop');
        this.content = this.modalElement.querySelector('.modal-content');
        this.titleElement = this.modalElement.querySelector('.modal-title');
        this.bodyElement = this.modalElement.querySelector('.modal-body');
        this.footerElement = this.modalElement.querySelector('.modal-footer');
        this.closeButton = this.modalElement.querySelector('.modal-close');

        this.isOpen = false;
        this.currentResolve = null;

        this.setupEventListeners();
    }

    /**
     * Configura gli event listener
     */
    setupEventListeners() {
        // Chiudi su click backdrop
        this.backdrop.addEventListener('click', () => this.close());

        // Chiudi su click pulsante X
        this.closeButton.addEventListener('click', () => this.close());

        // Chiudi su ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Apre il modal con contenuto personalizzato
     * @param {Object} options - Opzioni del modal
     * @returns {Promise} - Risolve quando il modal viene chiuso
     */
    open(options = {}) {
        const {
            title = '',
            body = '',
            footer = '',
            className = '',
            closable = true
        } = options;

        // Imposta contenuto
        this.titleElement.textContent = title;

        if (typeof body === 'string') {
            this.bodyElement.innerHTML = body;
        } else if (body instanceof HTMLElement) {
            this.bodyElement.innerHTML = '';
            this.bodyElement.appendChild(body);
        }

        if (typeof footer === 'string') {
            this.footerElement.innerHTML = footer;
        } else if (footer instanceof HTMLElement) {
            this.footerElement.innerHTML = '';
            this.footerElement.appendChild(footer);
        }

        // Mostra/nascondi footer
        this.footerElement.style.display = footer ? 'flex' : 'none';

        // Mostra/nascondi pulsante chiudi
        this.closeButton.style.display = closable ? 'flex' : 'none';

        // Applica classe aggiuntiva
        this.content.className = 'modal-content ' + className;

        // Mostra modal
        this.modalElement.classList.remove('hidden');
        requestAnimationFrame(() => {
            this.modalElement.classList.add('active');
        });

        this.isOpen = true;

        // Blocca scroll body
        document.body.style.overflow = 'hidden';

        return new Promise(resolve => {
            this.currentResolve = resolve;
        });
    }

    /**
     * Chiude il modal
     * @param {*} [result] - Valore da passare alla Promise
     */
    close(result = null) {
        if (!this.isOpen) return;

        this.modalElement.classList.remove('active');

        setTimeout(() => {
            this.modalElement.classList.add('hidden');
            this.bodyElement.innerHTML = '';
            this.footerElement.innerHTML = '';
        }, 250);

        this.isOpen = false;

        // Ripristina scroll body
        document.body.style.overflow = '';

        if (this.currentResolve) {
            this.currentResolve(result);
            this.currentResolve = null;
        }
    }

    /**
     * Mostra un modal di conferma
     * @param {string} title - Titolo
     * @param {string} message - Messaggio
     * @param {Object} [options] - Opzioni aggiuntive
     * @returns {Promise<boolean>}
     */
    confirm(title, message, options = {}) {
        const {
            confirmText = 'Conferma',
            cancelText = 'Annulla',
            confirmClass = 'btn-primary',
            danger = false
        } = options;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = 'var(--space-sm)';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = cancelText;
        cancelBtn.onclick = () => this.close(false);

        const confirmBtn = document.createElement('button');
        confirmBtn.className = `btn ${danger ? 'btn-danger' : confirmClass}`;
        confirmBtn.textContent = confirmText;
        confirmBtn.onclick = () => this.close(true);

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        return this.open({
            title,
            body: `<p>${message}</p>`,
            footer
        });
    }

    /**
     * Mostra un modal di alert
     * @param {string} title - Titolo
     * @param {string} message - Messaggio
     * @param {string} [buttonText='OK']
     * @returns {Promise}
     */
    alert(title, message, buttonText = 'OK') {
        const footer = document.createElement('div');

        const okBtn = document.createElement('button');
        okBtn.className = 'btn btn-primary';
        okBtn.textContent = buttonText;
        okBtn.onclick = () => this.close();

        footer.appendChild(okBtn);

        return this.open({
            title,
            body: `<p>${message}</p>`,
            footer
        });
    }

    /**
     * Mostra un modal con input di testo
     * @param {string} title - Titolo
     * @param {Object} [options] - Opzioni
     * @returns {Promise<string|null>}
     */
    prompt(title, options = {}) {
        const {
            message = '',
            placeholder = '',
            defaultValue = '',
            inputType = 'text',
            confirmText = 'OK',
            cancelText = 'Annulla'
        } = options;

        const body = document.createElement('div');
        body.className = 'form-group';

        if (message) {
            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = message;
            body.appendChild(label);
        }

        const input = document.createElement('input');
        input.type = inputType;
        input.className = 'form-input';
        input.placeholder = placeholder;
        input.value = defaultValue;
        body.appendChild(input);

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = 'var(--space-sm)';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = cancelText;
        cancelBtn.onclick = () => this.close(null);

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.textContent = confirmText;
        confirmBtn.onclick = () => this.close(input.value);

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        // Focus sull'input quando il modal è aperto
        setTimeout(() => input.focus(), 300);

        // Submit su Enter
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.close(input.value);
            }
        });

        return this.open({ title, body, footer });
    }

    /**
     * Mostra un modal con un form custom
     * @param {string} title
     * @param {HTMLFormElement} form
     * @returns {Promise<FormData|null>}
     */
    form(title, form) {
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = 'var(--space-sm)';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Annulla';
        cancelBtn.type = 'button';
        cancelBtn.onclick = () => this.close(null);

        const submitBtn = document.createElement('button');
        submitBtn.className = 'btn btn-primary';
        submitBtn.textContent = 'Salva';
        submitBtn.type = 'submit';

        footer.appendChild(cancelBtn);
        footer.appendChild(submitBtn);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            this.close(formData);
        });

        return this.open({ title, body: form, footer });
    }

    /**
     * Mostra modal per QR code
     * @param {string} title
     * @param {HTMLCanvasElement} qrCanvas
     * @param {string} url
     */
    showQR(title, qrCanvas, url) {
        const body = document.createElement('div');
        body.className = 'qr-container';

        const qrWrapper = document.createElement('div');
        qrWrapper.className = 'qr-code';
        qrWrapper.appendChild(qrCanvas);
        body.appendChild(qrWrapper);

        const linkDiv = document.createElement('div');
        linkDiv.className = 'qr-link';
        linkDiv.textContent = url;
        body.appendChild(linkDiv);

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = 'var(--space-sm)';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-secondary';
        copyBtn.textContent = 'Copia link';
        copyBtn.onclick = async () => {
            await navigator.clipboard.writeText(url);
            copyBtn.textContent = 'Copiato!';
            setTimeout(() => copyBtn.textContent = 'Copia link', 2000);
        };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-primary';
        closeBtn.textContent = 'Chiudi';
        closeBtn.onclick = () => this.close();

        footer.appendChild(copyBtn);
        footer.appendChild(closeBtn);

        return this.open({ title, body, footer });
    }

    /**
     * Mostra modal di loading
     * @param {string} [message='Caricamento...']
     * @returns {Function} - Funzione per chiudere il loading
     */
    loading(message = 'Caricamento...') {
        const body = document.createElement('div');
        body.className = 'text-center';
        body.innerHTML = `
            <div class="loading-spinner" style="margin: var(--space-lg) auto;"></div>
            <p>${message}</p>
        `;

        this.open({
            title: '',
            body,
            closable: false
        });

        return () => this.close();
    }
}

// Istanza singleton
let modalInstance = null;

export function getModal() {
    if (!modalInstance) {
        modalInstance = new Modal();
    }
    return modalInstance;
}

export default Modal;
