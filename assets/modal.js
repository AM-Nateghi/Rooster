// Modal dialog system
class ModalManager {
    constructor() {
        this.modals = new Map();
    }

    /**
     * Show a confirmation dialog
     * @param {string} message - The confirmation message
     * @param {object} options - Additional options
     * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
     */
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'تایید',
                confirmText = 'تایید',
                cancelText = 'لغو',
                confirmColor = 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
                cancelColor = 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
            } = options;

            const modalId = 'modal-' + Date.now();
            const modalHTML = `
                <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fadeIn">
                    <div class="absolute inset-0 bg-black/50 dark:bg-black/70" data-modal-backdrop></div>
                    <div class="relative bg-white dark:bg-slate-800 backdrop-blur-sm rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-scaleIn">
                        <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-3">${title}</h3>
                        <p class="text-sm text-slate-700 dark:text-slate-300 mb-6 leading-relaxed">${message}</p>
                        <div class="flex gap-3 justify-end">
                            <button class="modal-cancel px-4 py-2 text-sm rounded-lg ${cancelColor} transition-all active:scale-95 font-medium">
                                ${cancelText}
                            </button>
                            <button class="modal-confirm px-4 py-2 text-sm rounded-lg text-white ${confirmColor} transition-all active:scale-95 font-medium">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = document.getElementById(modalId);

            const cleanup = () => {
                modal.classList.add('animate-fadeOut');
                setTimeout(() => modal.remove(), 200);
                this.modals.delete(modalId);
            };

            modal.querySelector('.modal-confirm').onclick = () => {
                cleanup();
                resolve(true);
            };

            modal.querySelector('.modal-cancel').onclick = () => {
                cleanup();
                resolve(false);
            };

            modal.querySelector('[data-modal-backdrop]').onclick = () => {
                cleanup();
                resolve(false);
            };

            this.modals.set(modalId, modal);
        });
    }

    /**
     * Show a prompt dialog
     * @param {string} message - The prompt message
     * @param {object} options - Additional options
     * @returns {Promise<string|null>} - Resolves to input value if confirmed, null if cancelled
     */
    prompt(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'ورودی',
                defaultValue = '',
                placeholder = '',
                confirmText = 'تایید',
                cancelText = 'لغو',
                confirmColor = 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
                cancelColor = 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
            } = options;

            const modalId = 'modal-' + Date.now();
            const modalHTML = `
                <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fadeIn">
                    <div class="absolute inset-0 bg-black/50 dark:bg-black/70" data-modal-backdrop></div>
                    <div class="relative bg-white dark:bg-slate-800 backdrop-blur-sm rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-scaleIn">
                        <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-3">${title}</h3>
                        <p class="text-sm text-slate-700 dark:text-slate-300 mb-3">${message}</p>
                        <input type="text"
                               class="modal-input w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-slate-800 dark:text-gray-100 placeholder-slate-400 dark:placeholder-slate-500 mb-4"
                               placeholder="${placeholder}"
                               value="${defaultValue}" />
                        <div class="flex gap-3 justify-end">
                            <button class="modal-cancel px-4 py-2 text-sm rounded-lg ${cancelColor} transition-all active:scale-95 font-medium">
                                ${cancelText}
                            </button>
                            <button class="modal-confirm px-4 py-2 text-sm rounded-lg text-white ${confirmColor} transition-all active:scale-95 font-medium">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = document.getElementById(modalId);
            const input = modal.querySelector('.modal-input');

            const cleanup = () => {
                modal.classList.add('animate-fadeOut');
                setTimeout(() => modal.remove(), 200);
                this.modals.delete(modalId);
            };

            modal.querySelector('.modal-confirm').onclick = () => {
                const value = input.value.trim();
                cleanup();
                resolve(value || null);
            };

            modal.querySelector('.modal-cancel').onclick = () => {
                cleanup();
                resolve(null);
            };

            modal.querySelector('[data-modal-backdrop]').onclick = () => {
                cleanup();
                resolve(null);
            };

            // Auto-focus input
            setTimeout(() => input.focus(), 100);

            // Submit on Enter
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    modal.querySelector('.modal-confirm').click();
                } else if (e.key === 'Escape') {
                    modal.querySelector('.modal-cancel').click();
                }
            };

            this.modals.set(modalId, modal);
        });
    }

    /**
     * Show an alert dialog
     * @param {string} message - The alert message
     * @param {object} options - Additional options
     * @returns {Promise<void>}
     */
    alert(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'اطلاعیه',
                buttonText = 'باشه',
                buttonColor = 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            } = options;

            const modalId = 'modal-' + Date.now();
            const modalHTML = `
                <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fadeIn">
                    <div class="absolute inset-0 bg-black/50 dark:bg-black/70" data-modal-backdrop></div>
                    <div class="relative bg-white dark:bg-slate-800 backdrop-blur-sm rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-scaleIn">
                        <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-3">${title}</h3>
                        <p class="text-sm text-slate-700 dark:text-slate-300 mb-6 leading-relaxed">${message}</p>
                        <div class="flex justify-end">
                            <button class="modal-close px-4 py-2 text-sm rounded-lg text-white ${buttonColor} transition-all active:scale-95 font-medium">
                                ${buttonText}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = document.getElementById(modalId);

            const cleanup = () => {
                modal.classList.add('animate-fadeOut');
                setTimeout(() => modal.remove(), 200);
                this.modals.delete(modalId);
                resolve();
            };

            modal.querySelector('.modal-close').onclick = cleanup;
            modal.querySelector('[data-modal-backdrop]').onclick = cleanup;

            this.modals.set(modalId, modal);
        });
    }
}

// Add CSS animations
if (!document.getElementById('modal-animations')) {
    const style = document.createElement('style');
    style.id = 'modal-animations';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes scaleIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
            animation: fadeIn 0.2s ease-out;
        }
        .animate-fadeOut {
            animation: fadeOut 0.2s ease-out;
        }
        .animate-scaleIn {
            animation: scaleIn 0.2s ease-out;
        }
    `;
    document.head.appendChild(style);
}

// Create global instance
window.modal = new ModalManager();
