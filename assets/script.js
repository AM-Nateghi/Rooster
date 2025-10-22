$(function () {
    let entriesByTopic = JSON.parse(localStorage.getItem("entriesByTopic") || '{"موضوع اصلی": []}');
    let currentTopic = localStorage.getItem("currentTopic") || Object.keys(entriesByTopic)[0] || "موضوع اصلی";
    let selectedId = null;
    let orderCounters = JSON.parse(localStorage.getItem("orderCounters") || "{}");
    let booksMeta = JSON.parse(localStorage.getItem("booksMeta") || "{}");

    // Legacy support: migrate old topicMeta to booksMeta
    const oldTopicMeta = JSON.parse(localStorage.getItem("topicMeta") || "{}");
    if (Object.keys(oldTopicMeta).length > 0 && Object.keys(booksMeta).length === 0) {
        Object.keys(oldTopicMeta).forEach(topic => {
            booksMeta[topic] = {
                id: randomDocId(),
                name: topic,
                created: oldTopicMeta[topic].created || Date.now(),
                ...oldTopicMeta[topic]
            };
        });
        localStorage.setItem("booksMeta", JSON.stringify(booksMeta));
    }

    function initializeTheme() {
        const isDark = localStorage.getItem("isDark") === "true";
        if (isDark) {
            $("body").addClass("dark");
            $(".dark-icon").removeClass("hidden");
            $(".light-icon").addClass("hidden");
        }
    }

    function saveToStorage() {
        localStorage.setItem("entriesByTopic", JSON.stringify(entriesByTopic));
        localStorage.setItem("currentTopic", currentTopic);
        localStorage.setItem("orderCounters", JSON.stringify(orderCounters));
        localStorage.setItem("booksMeta", JSON.stringify(booksMeta));
    }

    function randomId() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$#*_";
        let id;
        do {
            id = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        } while (entriesByTopic[currentTopic]?.some(e => e.id === id));
        return id;
    }

    function randomDocId() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        return "doc_" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    function randomLinkId() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$#*_";
        return "link_" + Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    function randomTopicId() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    function getWordCount(text) {
        return text.trim().split(/\s+/).filter(Boolean).length;
    }

    function badgeColor(words) {
        if (words < 150) return "bg-green-500";
        if (words < 725) return "bg-blue-500";
        return "bg-red-500";
    }

    function updateStats() {
        const total = Object.values(entriesByTopic).reduce((sum, arr) => sum + arr.length, 0);
        const topics = Object.keys(entriesByTopic).length;
        const allWords = Object.values(entriesByTopic).flat().map(e => getWordCount(e.input));
        const avg = allWords.length ? Math.round(allWords.reduce((a, b) => a + b, 0) / allWords.length) : 0;

        $("#totalCount").text(total);
        $("#topicCount").text(topics);
        $("#avgWords").text(avg);
    }

    function renderTabs() {
        $("#tabs").empty();
        Object.keys(entriesByTopic).forEach(topic => {
            const count = entriesByTopic[topic].length;
            const tab = $(`
                <button class="tab px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap flex items-center gap-1.5 text-slate-700 dark:text-slate-200 transition-colors ${topic === currentTopic ? 'active-tab' : 'glass-card hover:bg-slate-200 dark:hover:bg-slate-600'}" data-topic="${topic}">
                    <span>${topic}</span>
                    <span class="text-xs opacity-80">(${count})</span>
                    <span class="tab-rename-icon text-xs cursor-pointer hover:scale-125" data-action="rename">✏️</span>
                    <span class="tab-delete-icon text-xs cursor-pointer hover:scale-125" data-action="delete">🗑️</span>
                </button>
            `);
            $("#tabs").append(tab);
        });

        const addBtn = $(`
            <button id="addTopic" class="px-3 py-1.5 text-sm rounded-lg whitespace-nowrap bg-white/70 text-slate-700 border border-slate-300 hover:bg-amber-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-600">
                ➕ موضوع جدید
            </button>
        `);
        $("#tabs").append(addBtn);
    }

    function render() {
        $("#entriesGrid").empty();
        const entries = entriesByTopic[currentTopic] || [];

        if (entries.length === 0) {
            $("#emptyState").removeClass("hidden");
            $("#entriesGrid").addClass("hidden");
        } else {
            $("#emptyState").addClass("hidden");
            $("#entriesGrid").removeClass("hidden");

            entries.sort((a, b) => b.order - a.order).forEach(e => { // Sort by order descending
                const preview = e.input.slice(0, 30);
                const words = getWordCount(e.input);
                const card = $(`
                    <div class="glass-card p-3 rounded-lg cursor-pointer hover:shadow-lg transition-all" data-id="${e.id}">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-mono text-slate-600 dark:text-slate-400">${e.id}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-500 font-semibold">#${e.order}</span>
                        </div>
                        <p class="text-sm text-slate-800 dark:text-slate-100 h-10 overflow-hidden text-ellipsis">${preview}</p>
                        <div class="flex justify-end items-center mt-2">
                            <span class="px-2 py-0.5 rounded-full text-xs font-bold text-white ${badgeColor(words)}">${words} کلمه</span>
                        </div>
                    </div>
                `);
                $("#entriesGrid").append(card);
            });
        }
        highlightSelected();
        updateStats();
    }

    function ensureTopicIds() {
        Object.keys(entriesByTopic).forEach(topic => {
            if (!booksMeta[topic]) {
                booksMeta[topic] = {
                    id: randomDocId(),
                    name: topic,
                    created: Date.now()
                };
            } else if (!booksMeta[topic].id || !booksMeta[topic].id.startsWith("doc_")) {
                // Migrate old format
                booksMeta[topic] = {
                    id: randomDocId(),
                    name: topic,
                    created: booksMeta[topic].created || Date.now(),
                    ...booksMeta[topic]
                };
            }
        });
        saveToStorage();
    }

    function toggleActionButtons(isSelected) {
        $("#updateBtn, #deleteBtn, #cancelBtn").prop("disabled", !isSelected).toggleClass("opacity-50 cursor-not-allowed", !isSelected);
        $("#addBtn").prop("disabled", isSelected).toggleClass("opacity-50 cursor-not-allowed", isSelected);
    }


    function select(id) {
        if (selectedId === id) { // Deselect if clicking the same card
            reset();
            return;
        }
        selectedId = id;
        const e = entriesByTopic[currentTopic].find(x => x.id === id);
        if (!e) return;
        $("#inputText").val(e.input).focus();
        toggleActionButtons(true);
        highlightSelected();
    }

    function highlightSelected() {
        $(".glass-card[data-id]").removeClass("selected-card");
        if (selectedId) {
            $(`.glass-card[data-id='${selectedId}']`).addClass("selected-card");
        }
    }

    function reset() {
        selectedId = null;
        $("#inputText").val("");
        toggleActionButtons(false);
        highlightSelected();
        $("#inputText").blur(); // Remove focus
    }

    $("#addBtn").on("click", function () {
        const text = $("#inputText").val().trim();
        if (!text) return toast.warning("لطفاً متنی وارد کنید!");
        if (!orderCounters[currentTopic]) orderCounters[currentTopic] = 0;
        if (!entriesByTopic[currentTopic]) entriesByTopic[currentTopic] = [];

        entriesByTopic[currentTopic].push({
            id: randomId(),
            order: ++orderCounters[currentTopic],
            instruct: "This is a default instruction.", // Default instruction
            input: text,
            output: ""
        });

        $("#inputText").val("");
        saveToStorage();
        render();
        renderTabs();
    });

    $("#updateBtn").on("click", function () {
        if (!selectedId) return;
        const text = $("#inputText").val().trim();
        if (!text) return toast.warning("متن نمی‌تواند خالی باشد!");
        const idx = entriesByTopic[currentTopic].findIndex(e => e.id === selectedId);
        if (idx > -1) {
            entriesByTopic[currentTopic][idx].input = text;
        }
        saveToStorage();
        render(); // Re-render to show updated card
        reset(); // Reset selection after update
    });

    $("#deleteBtn").on("click", async function () {
        if (!selectedId) return;
        if (!await modal.confirm("آیا از حذف این آیتم مطمئن هستید؟", { title: "تایید حذف" })) return;

        // Remove the selected chunk
        entriesByTopic[currentTopic] = entriesByTopic[currentTopic].filter(e => e.id !== selectedId);

        // Re-order remaining chunks from 1 to n
        const remainingChunks = entriesByTopic[currentTopic];
        remainingChunks.sort((a, b) => a.order - b.order); // Sort by old order first
        remainingChunks.forEach((chunk, index) => {
            chunk.order = index + 1;
        });

        // Update order counter
        orderCounters[currentTopic] = remainingChunks.length;

        saveToStorage();
        reset();
        render();
        renderTabs();
    });

    $("#cancelBtn").on("click", reset);

    $("#darkToggle").on("click", function () {
        const body = $("body");
        body.toggleClass("dark");
        const isDark = body.hasClass("dark");
        $(".dark-icon").toggleClass("hidden", !isDark);
        $(".light-icon").toggleClass("hidden", isDark);
        localStorage.setItem("isDark", isDark);
        // Re-render UI so dynamic elements receive correct classes/colors
        renderTabs();
        render();
    });

    // Use event delegation for dynamically created elements
    $(document).on("click", ".tab", function (e) {
        const action = $(e.target).data("action") || $(e.target).parent().data("action");
        if (action === "rename" || action === "delete") return;
        currentTopic = $(this).data("topic");
        saveToStorage();
        reset(); // Also reset selection
        render();
        renderTabs();
    });

    $(document).on("click", ".tab-rename-icon", async function (e) {
        e.stopPropagation();
        const oldTopic = $(this).closest(".tab").data("topic");
        const newName = await modal.prompt("نام جدید برای موضوع:", { defaultValue: oldTopic, title: "تغییر نام موضوع" });
        if (newName && newName.trim() && newName !== oldTopic) {
            if (entriesByTopic[newName]) return toast.warning("این نام قبلاً استفاده شده است!");

            // Atomically update data
            Object.defineProperty(entriesByTopic, newName, Object.getOwnPropertyDescriptor(entriesByTopic, oldTopic));
            delete entriesByTopic[oldTopic];

            if (currentTopic === oldTopic) {
                currentTopic = newName;
            }
            if (orderCounters[oldTopic]) {
                orderCounters[newName] = orderCounters[oldTopic];
                delete orderCounters[oldTopic];
            }

            if (booksMeta[oldTopic]) {
                booksMeta[newName] = { ...booksMeta[oldTopic], name: newName };
                delete booksMeta[oldTopic];
            } else {
                booksMeta[newName] = {
                    id: randomDocId(),
                    name: newName,
                    created: Date.now()
                };
            }

            saveToStorage();
            renderTabs();
            render();
        }
    });

    $(document).on("click", ".tab-delete-icon", async function (e) {
        e.stopPropagation();
        const topic = $(this).closest(".tab").data("topic");
        if (!topic) return;
        if (!await modal.confirm(`آیا از حذف موضوع "${topic}" مطمئن هستید؟ این عملیات غیرقابل بازگشت است.`, { title: "تایید حذف موضوع" })) return;
        // Delete topic data
        delete entriesByTopic[topic];
        if (orderCounters[topic] !== undefined) delete orderCounters[topic];
        if (booksMeta[topic] !== undefined) delete booksMeta[topic];
        // Reassign currentTopic if needed
        const topics = Object.keys(entriesByTopic);
        if (!topics.length) {
            const defaultName = "موضوع اصلی";
            entriesByTopic[defaultName] = [];
            orderCounters[defaultName] = 0;
            booksMeta[defaultName] = {
                id: randomDocId(),
                name: defaultName,
                created: Date.now()
            };
            currentTopic = defaultName;
        } else if (currentTopic === topic) {
            currentTopic = topics[0];
        }
        saveToStorage();
        reset();
        renderTabs();
        render();
    });

    $(document).on("click", "#addTopic", async function () {
        const name = await modal.prompt("نام موضوع/کتاب جدید:", { title: "ایجاد موضوع جدید" });
        if (name && name.trim()) {
            if (entriesByTopic[name]) return toast.warning("این نام قبلاً استفاده شده است!");
            entriesByTopic[name] = [];
            currentTopic = name;
            booksMeta[name] = {
                id: randomDocId(),
                name: name,
                created: Date.now()
            };
            saveToStorage();
            reset();
            renderTabs();
            render();
        }
    });

    $(document).on("click", ".glass-card[data-id]", function () {
        select($(this).data("id"));
    });

    async function openExportModal() {
        const topics = Object.keys(entriesByTopic);

        // Create the modal content
        const modalId = 'export-modal-' + Date.now();
        const modalHTML = `
            <div id="${modalId}" class="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fadeIn">
                <div class="absolute inset-0 bg-black/50 dark:bg-black/70" data-modal-backdrop></div>
                <div class="relative bg-white dark:bg-slate-800 backdrop-blur-sm rounded-xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-scaleIn">
                    <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-3">انتخاب موضوعات برای خروجی</h3>
                    <p class="text-xs text-slate-600 dark:text-slate-400 mb-3">موضوعات مورد نظر را انتخاب کنید. اگر هیچکدام را انتخاب نکنید، همه موضوعات خروجی گرفته می‌شود.</p>
                    <div id="exportTopicChips" class="flex flex-wrap gap-2 max-h-60 overflow-auto py-2 mb-4">
                        ${topics.map(t => `
                            <button class="export-chip px-3 py-1.5 text-sm rounded-full border select-none transition-all hover:scale-105 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600"
                                    data-topic="${t}">
                                <span class="font-medium">${t}</span>
                            </button>
                        `).join('')}
                    </div>
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex gap-2">
                            <button id="exportSelectAll" class="px-3 py-1.5 text-xs rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95 font-medium">
                                انتخاب همه
                            </button>
                            <button id="exportClearAll" class="px-3 py-1.5 text-xs rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95 font-medium">
                                حذف همه
                            </button>
                        </div>
                        <div class="flex gap-2">
                            <button class="modal-cancel px-4 py-2 text-sm rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95 font-medium">
                                لغو
                            </button>
                            <button class="modal-confirm px-4 py-2 text-sm rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all active:scale-95 font-medium">
                                دانلود
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const $modal = $(`#${modalId}`);

        // Update chip visual state
        function updateChipsVisual() {
            $modal.find('.export-chip').each(function () {
                const $chip = $(this);
                const active = $chip.hasClass('active');

                if (active) {
                    $chip.removeClass('text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600');
                    $chip.addClass('bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500');
                } else {
                    $chip.removeClass('bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500');
                    $chip.addClass('text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600');
                }
            });
        }

        // Toggle chip selection
        $modal.on('click', '.export-chip', function () {
            $(this).toggleClass('active');
            updateChipsVisual();
        });

        // Select all
        $modal.on('click', '#exportSelectAll', function () {
            $modal.find('.export-chip').addClass('active');
            updateChipsVisual();
        });

        // Clear all
        $modal.on('click', '#exportClearAll', function () {
            $modal.find('.export-chip').removeClass('active');
            updateChipsVisual();
        });

        // Cleanup function
        const cleanup = () => {
            $modal.addClass('animate-fadeOut');
            setTimeout(() => $modal.remove(), 200);
        };

        // Cancel
        $modal.on('click', '.modal-cancel, [data-modal-backdrop]', cleanup);

        // Confirm and export
        $modal.on('click', '.modal-confirm', async function () {
            const selectedTopics = $modal.find('.export-chip.active').map(function () {
                return $(this).data('topic');
            }).get();

            const finalTopics = selectedTopics.length ? selectedTopics : topics;

            try {
                // First sync with backend to ensure latest data
                await syncWithBackendSilent();

                // Fetch complete data from backend including graph connections
                const res = await fetch("/export");
                if (!res.ok) throw new Error("Export failed");
                const fullData = await res.json();

                // Filter data based on selected topics
                const filteredEntries = Object.fromEntries(
                    finalTopics.map(t => [t, fullData.entriesByTopic[t] || []])
                );
                const filteredOrder = Object.fromEntries(
                    finalTopics.map(t => [t, fullData.orderCounters[t] || 0])
                );
                const filteredMeta = Object.fromEntries(
                    finalTopics.map(t => [t, fullData.booksMeta[t] || { id: randomDocId(), name: t, created: Date.now() }])
                );

                // Filter graph connections - only include connections for selected topics' documents
                const selectedDocIds = finalTopics
                    .map(t => fullData.booksMeta[t]?.id)
                    .filter(Boolean);
                const filteredGraphConnections = Object.fromEntries(
                    selectedDocIds.map(docId => [docId, fullData.graphConnections[docId] || []])
                );

                // Create export data with all components including graph
                const exportData = {
                    entriesByTopic: filteredEntries,
                    orderCounters: filteredOrder,
                    currentTopic: finalTopics.includes(fullData.currentTopic) ? fullData.currentTopic : finalTopics[0],
                    booksMeta: filteredMeta,
                    graphConnections: filteredGraphConnections,
                    exportedAt: fullData.exportedAt,
                    version: fullData.version
                };

                const filename = `dataset-${finalTopics.length === 1 ? finalTopics[0] : 'multi'}-${new Date().toISOString().slice(0, 10)}.json`;
                const json = JSON.stringify(exportData, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                cleanup();
                toast.success('فایل JSON با موفقیت دانلود شد (شامل داده‌های گراف)');
            } catch (e) {
                console.error(e);
                toast.error('خطا در دانلود فایل. اطمینان حاصل کنید که سرور در حال اجرا است.');
            }
        });
    }

    $(document).on("click", "#exportBtn", openExportModal);

    async function syncWithBackendSilent() {
        const payload = {
            entriesByTopic,
            currentTopic,
            orderCounters,
            booksMeta
        };

        try {
            const res = await fetch("/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Sync failed");

            // Also sync graph connections from localStorage
            const graphConnections = JSON.parse(localStorage.getItem("graphConnections") || "{}");
            const graphRes = await fetch("/sync_graph", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ booksMeta, graphConnections })
            });
            if (!graphRes.ok) throw new Error("Graph sync failed");

            return true;
        } catch (e) {
            console.error("Silent sync failed:", e);
            return false;
        }
    }

    async function syncWithBackend() {
        const $btn = $("#syncBtn");
        const $icon = $btn.find(".sync-icon");
        const $text = $btn.find(".sync-text");
        const $spinner = $btn.find(".sync-spinner");

        // Loading state
        $btn.prop("disabled", true).addClass("opacity-70 cursor-not-allowed");
        $spinner.removeClass("hidden");
        $icon.addClass("hidden");
        $text.text("در حال سینک...");

        try {
            const success = await syncWithBackendSilent();
            if (!success) throw new Error("Sync failed");
            $text.text("سینک شد ✅");
            setTimeout(() => { $text.text("سینک با بک‌اند"); }, 1500);
        } catch (e) {
            console.error(e);
            toast.error("خطا در سینک با بک‌اند");
            $text.text("خطا ❌");
            setTimeout(() => { $text.text("سینک با بک‌اند"); }, 1500);
        } finally {
            $btn.prop("disabled", false).removeClass("opacity-70 cursor-not-allowed");
            $spinner.addClass("hidden");
            $icon.removeClass("hidden");
        }
    }

    $("#syncBtn").on("click", syncWithBackend);

    async function restoreFromBackend() {
        const $btn = $("#restoreBtn");
        const $icon = $btn.find(".restore-icon");
        const $text = $btn.find(".restore-text");
        const $spinner = $btn.find(".restore-spinner");

        $btn.prop("disabled", true).addClass("opacity-70 cursor-not-allowed");
        $spinner.removeClass("hidden");
        $icon.addClass("hidden");
        $text.text("در حال بازیابی...");

        try {
            // Restore entries data
            const res = await fetch("/restore");
            if (!res.ok) throw new Error("Restore failed");
            const data = await res.json();

            // Restore graph data
            const graphRes = await fetch("/restore_graph");
            if (!graphRes.ok) throw new Error("Graph restore failed");
            const graphData = await graphRes.json();

            // Prefer server as source of truth upon restore
            entriesByTopic = data.entriesByTopic || {};
            orderCounters = data.orderCounters || {};
            booksMeta = data.booksMeta || data.topicMeta || {}; // Support old format
            currentTopic = data.currentTopic || Object.keys(entriesByTopic)[0] || currentTopic;

            // Restore graph connections to localStorage
            if (graphData.graphConnections) {
                localStorage.setItem("graphConnections", JSON.stringify(graphData.graphConnections));
            }

            ensureTopicIds();
            saveToStorage();
            reset();
            renderTabs();
            render();
            $text.text("بازیابی شد ✅");
            setTimeout(() => { $text.text("بازیابی از بک‌اند"); }, 1500);
        } catch (e) {
            console.error(e);
            toast.error("خطا در بازیابی از بک‌اند");
            $text.text("خطا ❌");
            setTimeout(() => { $text.text("بازیابی از بک‌اند"); }, 1500);
        } finally {
            $btn.prop("disabled", false).removeClass("opacity-70 cursor-not-allowed");
            $spinner.addClass("hidden");
            $icon.removeClass("hidden");
        }
    }

    $("#restoreBtn").on("click", restoreFromBackend);

    async function createBackup() {
        const $btn = $("#backupBtn");
        const $icon = $btn.find(".backup-icon");
        const $text = $btn.find(".backup-text");
        const $spinner = $btn.find(".backup-spinner");

        $btn.prop("disabled", true).addClass("opacity-70 cursor-not-allowed");
        $spinner.removeClass("hidden");
        $icon.addClass("hidden");
        $text.text("در حال بک‌آپ...");

        try {
            const res = await fetch("/backup", {
                method: "POST"
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || "Backup failed");
            }
            const data = await res.json();
            toast.success(data.message || "بک‌آپ با موفقیت ایجاد شد");
            $text.text("بک‌آپ شد ✅");
            setTimeout(() => { $text.text("بک‌آپ گرفتن"); }, 1500);
        } catch (e) {
            console.error(e);
            toast.error(e.message || "خطا در ایجاد بک‌آپ");
            $text.text("خطا ❌");
            setTimeout(() => { $text.text("بک‌آپ گرفتن"); }, 1500);
        } finally {
            $btn.prop("disabled", false).removeClass("opacity-70 cursor-not-allowed");
            $spinner.addClass("hidden");
            $icon.removeClass("hidden");
        }
    }

    $("#backupBtn").on("click", createBackup);

    // Import Gemini Book (JSON from Gemini output)
    const geminiFileInput = $('<input type="file" id="importGeminiFile" accept="application/json" class="hidden" />');
    document.body.appendChild(geminiFileInput[0]);

    $(document).on("click", "#importGeminiBtn", function () {
        geminiFileInput.trigger("click");
    });

    geminiFileInput.on("change", async function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function () {
            try {
                const geminiData = JSON.parse(reader.result);

                // Validate Gemini format
                if (!geminiData.bookName || !geminiData.docId || !geminiData.chunks) {
                    throw new Error("فرمت فایل Gemini نامعتبر است. فیلدهای bookName، docId و chunks الزامی است.");
                }

                // First sync current state with backend
                await syncWithBackendSilent();

                // Send to backend endpoint
                const res = await fetch("/import_gemini_book", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(geminiData)
                });

                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.detail || "خطا در افزودن کتاب");
                }

                const result = await res.json();

                // Reload data from backend
                await restoreFromBackend();

                toast.success(
                    `${result.message}\n` +
                    `📊 تعداد چانک‌ها: ${result.chunksCount}\n` +
                    `🔗 تعداد روابط: ${result.graphConnectionsCount}`
                );

            } catch (err) {
                console.error(err);
                toast.error(err.message || "خطا در افزودن کتاب از Gemini");
            } finally {
                geminiFileInput.val("");
            }
        };
        reader.readAsText(file, "utf-8");
    });

    // Import from file (JSON)
    const fileInput = $('<input type="file" id="importFile" accept="application/json" class="hidden" />');
    document.body.appendChild(fileInput[0]);
    $(document).on("click", "#importBtn", function () { fileInput.trigger("click"); });
    fileInput.on("change", function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
            try {
                const data = JSON.parse(reader.result);
                const eb = data.entriesByTopic || {};
                const oc = data.orderCounters || {};
                const bm = data.booksMeta || data.topicMeta || {}; // Support old format
                const gc = data.graphConnections || {}; // Import graph connections

                // Merge topics into current state
                Object.keys(eb).forEach(t => { entriesByTopic[t] = eb[t]; });
                Object.keys(oc).forEach(t => { orderCounters[t] = oc[t]; });
                Object.keys(bm).forEach(t => {
                    // Migrate old format to new format if needed
                    if (bm[t].id && !bm[t].id.startsWith("doc_")) {
                        booksMeta[t] = {
                            id: randomDocId(),
                            name: t,
                            created: bm[t].created || Date.now(),
                            ...bm[t]
                        };
                    } else {
                        booksMeta[t] = bm[t];
                    }
                });

                // Import graph connections to localStorage
                if (Object.keys(gc).length > 0) {
                    const existingGraphConnections = JSON.parse(localStorage.getItem("graphConnections") || "{}");
                    // Merge graph connections (new data overwrites existing)
                    Object.keys(gc).forEach(docId => {
                        existingGraphConnections[docId] = gc[docId];
                    });
                    localStorage.setItem("graphConnections", JSON.stringify(existingGraphConnections));
                }

                ensureTopicIds();
                saveToStorage();
                renderTabs();
                render();

                const graphCount = Object.keys(gc).length;
                const msg = graphCount > 0
                    ? `ایمپورت با موفقیت انجام شد (${graphCount} گراف وارد شد).`
                    : "ایمپورت با موفقیت انجام شد.";
                toast.success(msg);
            } catch (err) {
                console.error(err);
                toast.error("فایل نامعتبر است.");
            } finally {
                fileInput.val("");
            }
        };
        reader.readAsText(file, "utf-8");
    });

    // Fix IDs for current topic
    $(document).on("click", "#fixIdsBtn", async function () {
        if (!await modal.confirm(
            `آیا از بازنشانی آیدی‌های تمام چانک‌های موضوع "${currentTopic}" مطمئن هستید؟\n` +
            `این عملیات روابط گراف مربوطه را نیز به‌روزرسانی می‌کند.`,
            { title: "تایید بازنشانی آیدی‌ها" }
        )) return;

        const $btn = $("#fixIdsBtn");
        const $icon = $btn.find(".fix-icon");
        const $text = $btn.find(".fix-text");
        const $spinner = $btn.find(".fix-spinner");

        $btn.prop("disabled", true).addClass("opacity-70 cursor-not-allowed");
        $spinner.removeClass("hidden");
        $icon.addClass("hidden");
        $text.text("در حال اصلاح...");

        try {
            const chunks = entriesByTopic[currentTopic] || [];
            if (chunks.length === 0) {
                toast.warning("هیچ چانکی برای بازنشانی وجود ندارد!");
                return;
            }

            // Create mapping from old IDs to new IDs
            const idMapping = {};
            const usedIds = new Set();

            // Collect all existing IDs from all topics to avoid collisions
            Object.values(entriesByTopic).flat().forEach(chunk => {
                if (chunk.id) usedIds.add(chunk.id);
            });

            // Generate new unique IDs for current topic's chunks
            chunks.forEach(chunk => {
                let newId;
                do {
                    newId = randomId();
                } while (usedIds.has(newId));

                idMapping[chunk.id] = newId;
                usedIds.add(newId);
                chunk.id = newId;
            });

            // Update graph connections
            const currentDocId = booksMeta[currentTopic]?.id;
            if (currentDocId) {
                const graphConnections = JSON.parse(localStorage.getItem("graphConnections") || "{}");

                if (graphConnections[currentDocId]) {
                    // Update source and target in all connections
                    graphConnections[currentDocId] = graphConnections[currentDocId].map(connection => {
                        const updatedConnection = { ...connection };

                        if (idMapping[connection.source]) {
                            updatedConnection.source = idMapping[connection.source];
                        }
                        if (idMapping[connection.target]) {
                            updatedConnection.target = idMapping[connection.target];
                        }

                        return updatedConnection;
                    });

                    localStorage.setItem("graphConnections", JSON.stringify(graphConnections));
                }
            }

            // Save changes
            saveToStorage();
            render();

            // Sync with backend
            await syncWithBackendSilent();

            toast.success(`${chunks.length} چانک با موفقیت بازنشانی شد`);
            $text.text("اصلاح شد ✅");
            setTimeout(() => { $text.text("اصلاح آیدی‌های چانک"); }, 1500);

        } catch (err) {
            console.error(err);
            toast.error("خطا در بازنشانی آیدی‌ها");
            $text.text("خطا ❌");
            setTimeout(() => { $text.text("اصلاح آیدی‌های چانک"); }, 1500);
        } finally {
            $btn.prop("disabled", false).removeClass("opacity-70 cursor-not-allowed");
            $spinner.addClass("hidden");
            $icon.removeClass("hidden");
        }
    });

    // Check for pending edit request from graph page
    function handlePendingEdit() {
        const pendingEditStr = localStorage.getItem('pendingEdit');
        if (!pendingEditStr) return;

        try {
            const pendingEdit = JSON.parse(pendingEditStr);
            const { book, chunkId, timestamp } = pendingEdit;

            // Check if timestamp is too old (older than 5 minutes)
            const FIVE_MINUTES = 5 * 60 * 1000;
            if (Date.now() - timestamp > FIVE_MINUTES) {
                console.log('Pending edit is too old, ignoring');
                localStorage.removeItem('pendingEdit');
                return;
            }

            // Check if the book exists
            if (!entriesByTopic[book]) {
                toast.warning(`کتاب "${book}" یافت نشد`);
                localStorage.removeItem('pendingEdit');
                return;
            }

            // Switch to the target book
            currentTopic = book;
            saveToStorage();
            renderTabs();
            render();

            // Find and select the chunk
            const chunk = entriesByTopic[book].find(e => e.id === chunkId);
            if (!chunk) {
                toast.warning(`چانک مورد نظر یافت نشد`);
                localStorage.removeItem('pendingEdit');
                return;
            }

            // Select the chunk for editing
            select(chunkId);

            // Clean up immediately to prevent reuse
            localStorage.removeItem('pendingEdit');

            // Show success message
            toast.success('چانک در حالت ویرایش بارگذاری شد');

            // Scroll to the selected card
            setTimeout(() => {
                const $card = $(`.glass-card[data-id='${chunkId}']`);
                if ($card.length) {
                    $card[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);

        } catch (err) {
            console.error('Error handling pending edit:', err);
            localStorage.removeItem('pendingEdit');
        }
    }

    // Reorder chunks in current topic
    $(document).on("click", "#reorderBtn", async function () {
        if (!await modal.confirm(
            `آیا از بازنشانی ترتیب چانک‌های موضوع "${currentTopic}" مطمئن هستید؟\n` +
            `چانک‌ها بر اساس ترتیب فعلی از 1 تا n شماره‌گذاری مجدد می‌شوند.`,
            { title: "تایید بازنشانی ترتیب" }
        )) return;

        const $btn = $("#reorderBtn");
        const $icon = $btn.find(".reorder-icon");
        const $text = $btn.find(".reorder-text");
        const $spinner = $btn.find(".reorder-spinner");

        $btn.prop("disabled", true).addClass("opacity-70 cursor-not-allowed");
        $spinner.removeClass("hidden");
        $icon.addClass("hidden");
        $text.text("در حال بازنشانی...");

        try {
            const chunks = entriesByTopic[currentTopic] || [];
            if (chunks.length === 0) {
                toast.warning("هیچ چانکی برای بازنشانی وجود ندارد!");
                return;
            }

            // Sort by current order
            chunks.sort((a, b) => a.order - b.order);

            // Re-assign orders from 1 to n
            chunks.forEach((chunk, index) => {
                chunk.order = index + 1;
            });

            // Update order counter
            orderCounters[currentTopic] = chunks.length;

            // Save changes
            saveToStorage();
            render();

            toast.success(`${chunks.length} چانک با موفقیت بازنشانی شد`);
            $text.text("بازنشانی شد ✅");
            setTimeout(() => { $text.text("بازنشانی ترتیب چانک‌ها"); }, 1500);

        } catch (err) {
            console.error(err);
            toast.error("خطا در بازنشانی ترتیب");
            $text.text("خطا ❌");
            setTimeout(() => { $text.text("بازنشانی ترتیب چانک‌ها"); }, 1500);
        } finally {
            $btn.prop("disabled", false).removeClass("opacity-70 cursor-not-allowed");
            $spinner.addClass("hidden");
            $icon.removeClass("hidden");
        }
    });

    // Initial Load
    initializeTheme();
    ensureTopicIds();
    renderTabs();
    render();
    handlePendingEdit();
});