// Compact dropdown component system
class DropdownManager {
    constructor() {
        this.activeDropdown = null;
        this.initGlobalClickHandler();
    }

    initGlobalClickHandler() {
        document.addEventListener('click', (e) => {
            if (this.activeDropdown && !this.activeDropdown.container.contains(e.target)) {
                this.activeDropdown.hide();
            }
        });
    }

    /**
     * Create a compact dropdown attached to an element
     * @param {string|HTMLElement} trigger - Selector or element that triggers the dropdown
     * @param {Array} options - Array of option objects {value, label, color?, icon?}
     * @param {object} config - Configuration options
     * @returns {object} - Dropdown instance with show/hide/destroy methods
     */
    create(trigger, options = [], config = {}) {
        const {
            placeholder = 'انتخاب کنید',
            width = 'auto',
            maxHeight = '240px',
            selectedValue = null,
            onChange = () => {},
            compact = false,
            position = 'bottom' // 'bottom' or 'top'
        } = config;

        const triggerEl = typeof trigger === 'string'
            ? document.querySelector(trigger)
            : trigger;

        if (!triggerEl) {
            console.error('Dropdown trigger element not found');
            return null;
        }

        // Create dropdown container
        const container = document.createElement('div');
        container.className = 'dropdown-container relative';
        container.style.width = width;

        // Create trigger button
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `dropdown-trigger w-full px-3 py-2 ${compact ? 'text-xs' : 'text-sm'} bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-slate-800 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg cursor-pointer transition-all hover:bg-white dark:hover:bg-slate-800 flex items-center justify-between gap-2`;

        const selectedOption = options.find(opt => opt.value === selectedValue);
        button.innerHTML = `
            <span class="dropdown-label truncate">${selectedOption ? selectedOption.label : placeholder}</span>
            <svg class="w-4 h-4 transition-transform dropdown-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        `;

        // Create options menu
        const menu = document.createElement('div');
        menu.className = `dropdown-menu hidden absolute ${position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-300 dark:border-slate-600 shadow-2xl overflow-hidden animate-scaleIn`;
        menu.style.maxHeight = maxHeight;
        menu.style.overflowY = 'auto';
        menu.style.zIndex = '9999';

        // Populate options
        options.forEach(option => {
            const optionEl = document.createElement('button');
            optionEl.type = 'button';
            optionEl.className = `dropdown-option w-full ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-right transition-colors flex items-center gap-2 ${option.value === selectedValue ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`;
            optionEl.style.color = 'inherit';

            let innerHTML = '';
            if (option.color) {
                innerHTML += `<div class="w-3 h-3 rounded-full flex-shrink-0" style="background: ${option.color};"></div>`;
            }
            if (option.icon) {
                innerHTML += `<span class="flex-shrink-0">${option.icon}</span>`;
            }
            innerHTML += `<span class="flex-1 truncate text-slate-800 dark:text-slate-200">${option.label}</span>`;

            if (option.meta) {
                innerHTML += `<span class="text-xs text-slate-500 dark:text-slate-400">${option.meta}</span>`;
            }

            optionEl.innerHTML = innerHTML;
            optionEl.dataset.value = option.value;

            optionEl.addEventListener('click', (e) => {
                e.stopPropagation();

                // Update button label
                const label = button.querySelector('.dropdown-label');
                label.textContent = option.label;

                // Update selected state
                menu.querySelectorAll('.dropdown-option').forEach(opt => {
                    opt.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
                });
                optionEl.classList.add('bg-blue-50', 'dark:bg-blue-900/20');

                // Call onChange
                onChange(option.value, option);

                // Hide menu
                instance.hide();
            });

            menu.appendChild(optionEl);
        });

        container.appendChild(button);
        container.appendChild(menu);

        // Replace trigger element with container
        triggerEl.replaceWith(container);

        // Create instance methods
        const instance = {
            container,
            button,
            menu,
            show() {
                // Hide any other active dropdown
                if (window.dropdown.activeDropdown && window.dropdown.activeDropdown !== this) {
                    window.dropdown.activeDropdown.hide();
                }

                menu.classList.remove('hidden');
                button.querySelector('.dropdown-arrow').style.transform = 'rotate(180deg)';
                window.dropdown.activeDropdown = this;
            },
            hide() {
                menu.classList.add('hidden');
                button.querySelector('.dropdown-arrow').style.transform = 'rotate(0deg)';
                if (window.dropdown.activeDropdown === this) {
                    window.dropdown.activeDropdown = null;
                }
            },
            toggle() {
                if (menu.classList.contains('hidden')) {
                    this.show();
                } else {
                    this.hide();
                }
            },
            getValue() {
                const selected = menu.querySelector('.dropdown-option.bg-blue-50, .dropdown-option.dark\\:bg-blue-900\\/20');
                return selected ? selected.dataset.value : null;
            },
            setValue(value) {
                const option = options.find(opt => opt.value === value);
                if (option) {
                    const label = button.querySelector('.dropdown-label');
                    label.textContent = option.label;

                    menu.querySelectorAll('.dropdown-option').forEach(opt => {
                        opt.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
                        if (opt.dataset.value === value) {
                            opt.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
                        }
                    });

                    onChange(value, option);
                }
            },
            updateOptions(newOptions) {
                menu.innerHTML = '';
                newOptions.forEach(option => {
                    const optionEl = document.createElement('button');
                    optionEl.type = 'button';
                    optionEl.className = `dropdown-option w-full ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-right transition-colors flex items-center gap-2`;
                    optionEl.style.color = 'inherit';

                    let innerHTML = '';
                    if (option.color) {
                        innerHTML += `<div class="w-3 h-3 rounded-full flex-shrink-0" style="background: ${option.color};"></div>`;
                    }
                    if (option.icon) {
                        innerHTML += `<span class="flex-shrink-0">${option.icon}</span>`;
                    }
                    innerHTML += `<span class="flex-1 truncate text-slate-800 dark:text-slate-200">${option.label}</span>`;

                    if (option.meta) {
                        innerHTML += `<span class="text-xs text-slate-500 dark:text-slate-400">${option.meta}</span>`;
                    }

                    optionEl.innerHTML = innerHTML;
                    optionEl.dataset.value = option.value;

                    optionEl.addEventListener('click', (e) => {
                        e.stopPropagation();

                        const label = button.querySelector('.dropdown-label');
                        label.textContent = option.label;

                        menu.querySelectorAll('.dropdown-option').forEach(opt => {
                            opt.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
                        });
                        optionEl.classList.add('bg-blue-50', 'dark:bg-blue-900/20');

                        onChange(option.value, option);
                        instance.hide();
                    });

                    menu.appendChild(optionEl);
                });
            },
            destroy() {
                container.remove();
            }
        };

        // Toggle dropdown on button click
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            instance.toggle();
        });

        return instance;
    }
}

// Create global instance
window.dropdown = new DropdownManager();
