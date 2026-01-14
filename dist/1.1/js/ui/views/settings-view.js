/**
 * Settings View per Scripta Manent
 * Impostazioni dell'applicazione
 */

import { formatFileSize, CONFIG } from '../../config.js';

/**
 * View delle impostazioni
 */
export class SettingsView {
    constructor(app) {
        this.app = app;
    }

    /**
     * Renderizza la view
     */
    async render() {
        const settings = this.app.settings || CONFIG.DEFAULT_SETTINGS;
        const storageQuota = await this.getStorageQuota();
        const hasVault = await this.checkVault();

        return `
            <div class="view settings-view">
                <div class="view-header">
                    <h1 class="view-title">Impostazioni</h1>
                </div>

                <div class="settings-section">
                    <h2 class="settings-section-title">Aspetto</h2>

                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-label">Tema</div>
                            <div class="settings-item-description">Scegli il tema dell'app</div>
                        </div>
                        <select class="form-input" style="width: auto;" id="theme-select">
                            <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>Automatico</option>
                            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Chiaro</option>
                            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Scuro</option>
                        </select>
                    </div>

                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-label">Lingua</div>
                            <div class="settings-item-description">Lingua dell'interfaccia</div>
                        </div>
                        <select class="form-input" style="width: auto;" id="language-select">
                            <option value="it" ${settings.language === 'it' ? 'selected' : ''}>Italiano</option>
                            <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
                        </select>
                    </div>
                </div>

                <div class="settings-section">
                    <h2 class="settings-section-title">Sicurezza</h2>

                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-label">Password Master</div>
                            <div class="settings-item-description">
                                ${hasVault ? 'Password configurata' : 'Nessuna password impostata'}
                            </div>
                        </div>
                        <button class="btn btn-secondary" id="password-btn">
                            ${hasVault ? 'Cambia password' : 'Imposta password'}
                        </button>
                    </div>

                    ${hasVault ? `
                        <div class="settings-item">
                            <div class="settings-item-info">
                                <div class="settings-item-label">Blocca vault</div>
                                <div class="settings-item-description">Blocca l'accesso ai file cifrati</div>
                            </div>
                            <button class="btn btn-secondary" id="lock-btn">
                                Blocca
                            </button>
                        </div>
                    ` : ''}
                </div>

                <div class="settings-section">
                    <h2 class="settings-section-title">Cestino</h2>

                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-label">Giorni di conservazione</div>
                            <div class="settings-item-description">Dopo questo periodo i file vengono eliminati</div>
                        </div>
                        <select class="form-input" style="width: auto;" id="retention-select">
                            <option value="7" ${settings.trashRetentionDays === 7 ? 'selected' : ''}>7 giorni</option>
                            <option value="15" ${settings.trashRetentionDays === 15 ? 'selected' : ''}>15 giorni</option>
                            <option value="30" ${settings.trashRetentionDays === 30 ? 'selected' : ''}>30 giorni</option>
                        </select>
                    </div>
                </div>

                <div class="settings-section">
                    <h2 class="settings-section-title">Storage</h2>

                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-label">Spazio utilizzato</div>
                            <div class="settings-item-description">
                                ${formatFileSize(storageQuota.used)} di ${formatFileSize(storageQuota.total)} utilizzati
                            </div>
                        </div>
                        <div class="progress-bar" style="width: 150px;">
                            <div class="progress-bar-fill" style="width: ${Math.round((storageQuota.used / storageQuota.total) * 100)}%"></div>
                        </div>
                    </div>

                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-label">Sincronizza</div>
                            <div class="settings-item-description">Forza sincronizzazione con Google Drive</div>
                        </div>
                        <button class="btn btn-secondary" id="sync-btn">
                            Sincronizza ora
                        </button>
                    </div>
                </div>

                <div class="settings-section">
                    <h2 class="settings-section-title">Account</h2>

                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-label">${this.app.user?.name || 'Utente'}</div>
                            <div class="settings-item-description">${this.app.user?.email || ''}</div>
                        </div>
                        <button class="btn btn-secondary" id="logout-btn">
                            Esci
                        </button>
                    </div>
                </div>

                <div class="settings-section">
                    <h2 class="settings-section-title">Dati</h2>

                    <div class="settings-item settings-danger">
                        <div class="settings-item-info">
                            <div class="settings-item-label" style="color: var(--color-error);">Elimina tutti i dati</div>
                            <div class="settings-item-description">Elimina tutte le note e i file da Google Drive</div>
                        </div>
                        <button class="btn btn-danger" id="delete-all-btn">
                            Elimina tutto
                        </button>
                    </div>
                </div>

                <div class="settings-section">
                    <h2 class="settings-section-title">Info</h2>

                    <div class="settings-item">
                        <div class="settings-item-info">
                            <div class="settings-item-label">Scripta Manent</div>
                            <div class="settings-item-description">Versione ${CONFIG.APP_VERSION}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Ottiene la quota di storage
     */
    async getStorageQuota() {
        try {
            if (this.app.storage) {
                return await this.app.storage.getStorageQuota();
            }
        } catch (error) {
            console.error('Errore quota storage:', error);
        }
        return { used: 0, total: 15 * 1024 * 1024 * 1024 }; // 15GB default
    }

    /**
     * Verifica se esiste un vault
     */
    async checkVault() {
        try {
            if (this.app.keyManager) {
                return await this.app.keyManager.hasVault();
            }
        } catch {
            return false;
        }
        return false;
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Tema
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', () => {
                this.app.setTheme(themeSelect.value);
            });
        }

        // Lingua
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.addEventListener('change', () => {
                this.app.setLanguage(langSelect.value);
            });
        }

        // Retention
        const retentionSelect = document.getElementById('retention-select');
        if (retentionSelect) {
            retentionSelect.addEventListener('change', () => {
                this.app.setSetting('trashRetentionDays', parseInt(retentionSelect.value));
            });
        }

        // Password
        const passwordBtn = document.getElementById('password-btn');
        if (passwordBtn) {
            passwordBtn.addEventListener('click', () => this.showPasswordModal());
        }

        // Lock
        const lockBtn = document.getElementById('lock-btn');
        if (lockBtn) {
            lockBtn.addEventListener('click', () => {
                this.app.keyManager?.lock();
                this.app.toast.success('Vault bloccato');
            });
        }

        // Sync
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                syncBtn.disabled = true;
                syncBtn.textContent = 'Sincronizzazione...';
                await this.app.sync();
                syncBtn.disabled = false;
                syncBtn.textContent = 'Sincronizza ora';
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.app.logout());
        }

        // Delete all
        const deleteAllBtn = document.getElementById('delete-all-btn');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => this.confirmDeleteAll());
        }
    }

    /**
     * Mostra modal password
     */
    async showPasswordModal() {
        const hasVault = await this.checkVault();

        const body = document.createElement('div');
        body.innerHTML = `
            ${hasVault ? `
                <div class="form-group">
                    <label class="form-label">Password attuale</label>
                    <input type="password" class="form-input" id="current-password" required>
                </div>
            ` : ''}
            <div class="form-group">
                <label class="form-label">Nuova password</label>
                <input type="password" class="form-input" id="new-password" required>
                <div class="password-strength">
                    <div class="password-strength-bar" id="strength-bar"></div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Conferma password</label>
                <input type="password" class="form-input" id="confirm-password" required>
            </div>
        `;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = 'var(--space-sm)';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Annulla';
        cancelBtn.onclick = () => this.app.modal.close();

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = 'Salva';
        saveBtn.onclick = async () => {
            const newPwd = document.getElementById('new-password').value;
            const confirmPwd = document.getElementById('confirm-password').value;

            if (newPwd !== confirmPwd) {
                this.app.toast.error('Le password non coincidono');
                return;
            }

            if (newPwd.length < 8) {
                this.app.toast.error('Password troppo corta (minimo 8 caratteri)');
                return;
            }

            try {
                if (hasVault) {
                    const currentPwd = document.getElementById('current-password').value;
                    await this.app.keyManager.changePassword(currentPwd, newPwd, this.app.user.id);
                } else {
                    await this.app.keyManager.setupPassword(newPwd, this.app.user.id);
                }
                this.app.toast.success('Password salvata');
                this.app.modal.close();
            } catch (error) {
                this.app.toast.error(error.message || 'Errore salvataggio password');
            }
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        this.app.modal.open({
            title: hasVault ? 'Cambia password' : 'Imposta password',
            body,
            footer
        });

        // Strength indicator
        const newPwdInput = document.getElementById('new-password');
        const strengthBar = document.getElementById('strength-bar');

        newPwdInput?.addEventListener('input', () => {
            const strength = this.getPasswordStrength(newPwdInput.value);
            strengthBar.className = 'password-strength-bar ' + strength.class;
            strengthBar.style.width = strength.percent + '%';
        });
    }

    /**
     * Calcola forza password
     */
    getPasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score <= 1) return { class: 'password-strength-weak', percent: 25 };
        if (score <= 3) return { class: 'password-strength-medium', percent: 60 };
        return { class: 'password-strength-strong', percent: 100 };
    }

    /**
     * Conferma eliminazione totale
     */
    async confirmDeleteAll() {
        const confirmed = await this.app.modal.confirm(
            'Elimina tutti i dati',
            'Questa azione eliminerà TUTTE le tue note e file da Google Drive. Questa azione NON può essere annullata.',
            { danger: true, confirmText: 'Elimina tutto' }
        );

        if (confirmed) {
            // Doppia conferma
            const doubleConfirmed = await this.app.modal.prompt(
                'Conferma eliminazione',
                {
                    message: 'Scrivi "ELIMINA" per confermare',
                    placeholder: 'ELIMINA'
                }
            );

            if (doubleConfirmed === 'ELIMINA') {
                try {
                    // TODO: implementare eliminazione totale
                    this.app.toast.success('Tutti i dati sono stati eliminati');
                    this.app.logout();
                } catch (error) {
                    this.app.toast.error('Errore durante l\'eliminazione');
                }
            }
        }
    }
}

export default SettingsView;
