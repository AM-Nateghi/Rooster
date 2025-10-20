// Toast notification system
class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none';
            this.container.style.cssText = 'min-width: 300px; max-width: 500px;';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast-item pointer-events-auto transform transition-all duration-300 ease-out translate-y-[-20px] opacity-0';

        const colors = {
            success: 'bg-green-500 dark:bg-green-600 text-white shadow-green-200 dark:shadow-green-900',
            error: 'bg-red-500 dark:bg-red-600 text-white shadow-red-200 dark:shadow-red-900',
            warning: 'bg-amber-500 dark:bg-amber-600 text-white shadow-amber-200 dark:shadow-amber-900',
            info: 'bg-blue-500 dark:bg-blue-600 text-white shadow-blue-200 dark:shadow-blue-900'
        };

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl ${colors[type] || colors.info}">
                <span class="text-xl font-bold">${icons[type] || icons.info}</span>
                <span class="flex-1 text-sm font-medium">${message}</span>
                <button class="toast-close text-lg hover:scale-125 transition-transform opacity-80 hover:opacity-100" onclick="this.closest('.toast-item').remove()">×</button>
            </div>
        `;

        this.container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        });

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('translate-y-[-20px]', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 4000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 3500) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
}

// Create global instance
window.toast = new ToastManager();
