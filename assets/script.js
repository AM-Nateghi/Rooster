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
                <button class="tab px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap flex items-center gap-1.5 ${topic === currentTopic ? 'active-tab' : 'glass-card hover:bg-slate-200 dark:hover:bg-slate-700'}" data-topic="${topic}">
                    <span>${topic}</span>
                    <span class="text-xs opacity-70">(${count})</span>
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
                    <div class="glass-card p-3 rounded-lg cursor-pointer hover:shadow-lg" data-id="${e.id}">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-mono opacity-60">${e.id}</span>
                            <span class="text-xs opacity-50">#${e.order}</span>
                        </div>
                        <p class="text-sm text-gray-800 dark:text-gray-200 h-10 overflow-hidden text-ellipsis">${preview}</p>
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
        if (!text) return alert("لطفاً متنی وارد کنید!");
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
        if (!text) return alert("متن نمی‌تواند خالی باشد!");
        const idx = entriesByTopic[currentTopic].findIndex(e => e.id === selectedId);
        if (idx > -1) {
            entriesByTopic[currentTopic][idx].input = text;
        }
        saveToStorage();
        render(); // Re-render to show updated card
        reset(); // Reset selection after update
    });

    $("#deleteBtn").on("click", function () {
        if (!selectedId || !confirm("آیا از حذف این آیتم مطمئن هستید؟")) return;
        entriesByTopic[currentTopic] = entriesByTopic[currentTopic].filter(e => e.id !== selectedId);
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

    $(document).on("click", ".tab-rename-icon", function (e) {
        e.stopPropagation();
        const oldTopic = $(this).closest(".tab").data("topic");
        const newName = prompt("نام جدید برای موضوع:", oldTopic);
        if (newName && newName.trim() && newName !== oldTopic) {
            if (entriesByTopic[newName]) return alert("این نام قبلاً استفاده شده است!");

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

    $(document).on("click", ".tab-delete-icon", function (e) {
        e.stopPropagation();
        const topic = $(this).closest(".tab").data("topic");
        if (!topic) return;
        if (!confirm(`آیا از حذف موضوع "${topic}" مطمئن هستید؟ این عملیات غیرقابل بازگشت است.`)) return;
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

    $(document).on("click", "#addTopic", function () {
        const name = prompt("نام موضوع/کتاب جدید:");
        if (name && name.trim()) {
            if (entriesByTopic[name]) return alert("این نام قبلاً استفاده شده است!");
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

    function openExportModal() {
        const $modal = $("#exportModal");
        const $chips = $("#exportTopicChips");
        $chips.empty();
        const topics = Object.keys(entriesByTopic);
        topics.forEach(t => {
            const chip = $(`
                <button class="export-chip px-3 py-1.5 text-sm rounded-full border select-none transition-colors"
                        data-topic="${t}">
                    <span class="font-medium">${t}</span>
                </button>
            `);
            $chips.append(chip);
        });
        updateExportChipsVisual();
        $modal.removeClass("hidden");
    }

    function closeExportModal() {
        $("#exportModal").addClass("hidden");
    }

    function updateExportChipsVisual() {
        $("#exportTopicChips .export-chip").each(function () {
            const $c = $(this);
            const active = $c.hasClass("active");
            // Reset classes first
            $c.removeClass("bg-blue-600 text-white border-blue-600 bg-white/70 text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 hover:bg-black hover:text-white");
            if (active) {
                $c.addClass("bg-blue-600 text-white border-blue-600");
            } else {
                $c.addClass("text-slate-800 border-slate-300 hover:bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700");
            }
        });
    }

    $(document).on("click", "#exportBtn", openExportModal);
    $(document).on("click", "#exportClose, #exportCancel", closeExportModal);
    $(document).on("click", "#exportSelectAll", function () {
        $("#exportTopicChips .export-chip").addClass("active");
        updateExportChipsVisual();
    });
    $(document).on("click", "#exportClearAll", function () {
        $("#exportTopicChips .export-chip").removeClass("active");
        updateExportChipsVisual();
    });
    $(document).on("click", "#exportTopicChips .export-chip", function () {
        $(this).toggleClass("active");
        updateExportChipsVisual();
    });

    function performExportWithSelectedTopics() {
        const selectedTopics = $("#exportTopicChips .export-chip.active").map(function () { return $(this).data("topic"); }).get();
        const finalTopics = selectedTopics.length ? selectedTopics : Object.keys(entriesByTopic);
        const filteredEntries = Object.fromEntries(finalTopics.map(t => [t, entriesByTopic[t] || []]));
        const filteredOrder = Object.fromEntries(finalTopics.map(t => [t, orderCounters[t] || 0]));
        const filteredMeta = Object.fromEntries(finalTopics.map(t => [t, booksMeta[t] || { id: randomDocId(), name: t, created: Date.now() }]));
        const filename = `dataset-${finalTopics.length === 1 ? finalTopics[0] : 'multi'}-${new Date().toISOString().slice(0, 10)}.json`;
        const json = JSON.stringify({ entriesByTopic: filteredEntries, orderCounters: filteredOrder, currentTopic, booksMeta: filteredMeta }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        closeExportModal();
    }
    $(document).on("click", "#exportConfirm", performExportWithSelectedTopics);

    async function syncWithBackend() {
        const $btn = $("#syncBtn");
        const $icon = $btn.find(".sync-icon");
        const $text = $btn.find(".sync-text");
        const $spinner = $btn.find(".sync-spinner");

        const payload = {
            entriesByTopic,
            currentTopic,
            orderCounters,
            booksMeta
        };

        // Loading state
        $btn.prop("disabled", true).addClass("opacity-70 cursor-not-allowed");
        $spinner.removeClass("hidden");
        $icon.addClass("hidden");
        $text.text("در حال سینک...");

        try {
            const res = await fetch("http://localhost:8000/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Sync failed");
            const data = await res.json();
            console.log("Synced:", data);
            $text.text("سینک شد ✅");
            setTimeout(() => { $text.text("سینک با بک‌اند"); }, 1500);
        } catch (e) {
            console.error(e);
            alert("خطا در سینک با بک‌اند");
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
            const res = await fetch("http://localhost:8000/restore");
            if (!res.ok) throw new Error("Restore failed");
            const data = await res.json();
            // Prefer server as source of truth upon restore
            entriesByTopic = data.entriesByTopic || {};
            orderCounters = data.orderCounters || {};
            booksMeta = data.booksMeta || data.topicMeta || {}; // Support old format
            currentTopic = data.currentTopic || Object.keys(entriesByTopic)[0] || currentTopic;
            ensureTopicIds();
            saveToStorage();
            reset();
            renderTabs();
            render();
            $text.text("بازیابی شد ✅");
            setTimeout(() => { $text.text("بازیابی از بک‌اند"); }, 1500);
        } catch (e) {
            console.error(e);
            alert("خطا در بازیابی از بک‌اند");
            $text.text("خطا ❌");
            setTimeout(() => { $text.text("بازیابی از بک‌اند"); }, 1500);
        } finally {
            $btn.prop("disabled", false).removeClass("opacity-70 cursor-not-allowed");
            $spinner.addClass("hidden");
            $icon.removeClass("hidden");
        }
    }

    $("#restoreBtn").on("click", restoreFromBackend);

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
                ensureTopicIds();
                saveToStorage();
                renderTabs();
                render();
                alert("ایمپورت با موفقیت انجام شد.");
            } catch (err) {
                console.error(err);
                alert("فایل نامعتبر است.");
            } finally {
                fileInput.val("");
            }
        };
        reader.readAsText(file, "utf-8");
    });

    // Initial Load
    initializeTheme();
    ensureTopicIds();
    renderTabs();
    render();
});