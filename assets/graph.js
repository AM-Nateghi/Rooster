// Global state
let graphData = { nodes: [], links: [] };
let entriesByTopic = {};
let booksMeta = {};
let graphConnections = {};
let currentBook = null;
let currentDocId = null;
let linkModeEnabled = false;
let selectedNodeForLink = null;
let simulation = null;

// Theme initialization
function initializeTheme() {
    const isDark = localStorage.getItem("isDark") === "true";
    if (isDark) {
        $("body").addClass("dark");
        $(".dark-icon").removeClass("hidden");
        $(".light-icon").addClass("hidden");
    }
}

$("#darkToggle").on("click", function () {
    const body = $("body");
    body.toggleClass("dark");
    const isDark = body.hasClass("dark");
    $(".dark-icon").toggleClass("hidden", !isDark);
    $(".light-icon").toggleClass("hidden", isDark);
    localStorage.setItem("isDark", isDark);
});

// Link type configurations
const linkTypes = {
    reference: { color: '#3b82f6', directed: true, width: 2 },
    'نتیجه‌گیری': { color: '#8b5cf6', directed: true, width: 2.5 },
    'ادامه متن': { color: '#06b6d4', directed: true, width: 2 },
    'مثال': { color: '#10b981', directed: false, width: 2 },
    'بیشتر بدانیم': { color: '#f59e0b', directed: false, width: 2 },
    default: { color: '#64748b', directed: true, width: 1.5 }
};

// Node type colors
const nodeColors = {
    'تعریف': '#3b82f6',
    'مثال': '#10b981',
    'توضیح': '#06b6d4',
    'نتیجه': '#8b5cf6',
    'مرجع': '#f59e0b',
    default: '#64748b'
};

// Helper functions for ID generation
function randomLinkId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$#*_";
    return "link_" + Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// CRUD functions for graph connections
function saveConnection(docId, sourceId, targetId, type) {
    if (!graphConnections[docId]) {
        graphConnections[docId] = [];
    }

    const connection = {
        id: randomLinkId(),
        source: sourceId,
        target: targetId,
        type: type || 'reference',
        createdAt: Date.now(),
        userDefined: true
    };

    graphConnections[docId].push(connection);
    localStorage.setItem("graphConnections", JSON.stringify(graphConnections));
    return connection;
}

function loadConnections(docId) {
    return graphConnections[docId] || [];
}

function deleteConnection(docId, linkId) {
    if (!graphConnections[docId]) return false;

    const index = graphConnections[docId].findIndex(c => c.id === linkId);
    if (index !== -1) {
        graphConnections[docId].splice(index, 1);
        localStorage.setItem("graphConnections", JSON.stringify(graphConnections));
        return true;
    }
    return false;
}

function validateConnections(docId, nodeIds) {
    if (!graphConnections[docId]) return;

    // Remove connections where source or target node doesn't exist
    graphConnections[docId] = graphConnections[docId].filter(conn => {
        return nodeIds.includes(conn.source) && nodeIds.includes(conn.target);
    });
    localStorage.setItem("graphConnections", JSON.stringify(graphConnections));
}

// Initialize D3 graph
const container = document.getElementById('graph-container');
const svg = d3.select('#graph');

function getGraphDimensions() {
    const rect = container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
}

const g = svg.append('g');

// Zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
        g.attr('transform', event.transform);
    });

svg.call(zoom);

// Arrow markers for directed edges
svg.append('defs').selectAll('marker')
    .data(Object.keys(linkTypes))
    .enter().append('marker')
    .attr('id', d => `arrow-${d}`)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', d => linkTypes[d]?.color || linkTypes.default.color);

// Load data from localStorage
function loadDataFromStorage() {
    try {
        const storedData = localStorage.getItem("entriesByTopic");
        const storedMeta = localStorage.getItem("booksMeta");
        const storedConnections = localStorage.getItem("graphConnections");

        if (storedData) {
            entriesByTopic = JSON.parse(storedData);
        }

        if (storedMeta) {
            booksMeta = JSON.parse(storedMeta);
        }

        if (storedConnections) {
            graphConnections = JSON.parse(storedConnections);
        }

        if (Object.keys(entriesByTopic).length > 0) {
            renderBookList();

            // Select first book by default
            const firstBook = Object.keys(entriesByTopic)[0];
            if (firstBook) {
                selectBook(firstBook);
            }

            $('#emptyState').hide();
        } else {
            $('#emptyState').show();
        }
    } catch (err) {
        console.error('خطا در خواندن داده‌ها از localStorage:', err);
        alert('خطا در بارگذاری داده‌ها');
        $('#emptyState').show();
    }
}

function renderBookList() {
    const $bookList = $('#bookList');
    $bookList.empty();

    Object.keys(entriesByTopic).forEach(book => {
        const count = entriesByTopic[book].length;
        const $item = $(`
                    <div class="book-item glass-card p-3 rounded-lg cursor-pointer hover:shadow-lg" data-book="${book}">
                        <div class="flex justify-between items-center">
                            <span class="font-medium text-sm text-slate-800 dark:text-slate-200">${book}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white">${count}</span>
                        </div>
                    </div>
                `);
        $bookList.append($item);
    });
}

$(document).on('click', '.book-item', function () {
    const book = $(this).data('book');
    selectBook(book);
});

function selectBook(book) {
    currentBook = book;

    // Get doc_id for this book
    currentDocId = booksMeta[book]?.id || null;

    // Update active state
    $('.book-item').removeClass('ring-2 ring-blue-500');
    $(`.book-item[data-book="${book}"]`).addClass('ring-2 ring-blue-500');

    // Transform data to graph format
    const entries = entriesByTopic[book] || [];
    graphData.nodes = entries.map(e => ({
        id: e.id,
        title: e.input.slice(0, 50) + (e.input.length > 50 ? '...' : ''),
        fullText: e.input,
        type: e.instruct || 'default',
        order: e.order
    }));

    // Load real connections from localStorage (NO MORE DEMO LINKS!)
    graphData.links = [];
    if (currentDocId) {
        const connections = loadConnections(currentDocId);
        const nodeIds = graphData.nodes.map(n => n.id);

        // Validate and load connections
        validateConnections(currentDocId, nodeIds);

        // Convert connections to link format
        graphData.links = connections.map(conn => ({
            id: conn.id,
            source: conn.source,
            target: conn.target,
            type: conn.type,
            createdAt: conn.createdAt,
            userDefined: conn.userDefined
        }));
    }

    updateStats();
    renderGraph();
}

function updateStats() {
    $('#nodeCount').text(graphData.nodes.length);
    $('#linkCount').text(graphData.links.length);
}

function renderGraph() {
    g.selectAll('*').remove();
    $('#detailPanel').hide();
    selectedNodeForLink = null;

    if (!graphData.nodes.length) return;

    const { width, height } = getGraphDimensions();

    // Create force simulation
    simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links)
            .id(d => d.id)
            .distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(35));

    // Draw links
    const link = g.append('g')
        .selectAll('line')
        .data(graphData.links)
        .enter().append('line')
        .attr('class', 'link')
        .attr('stroke', d => {
            const config = linkTypes[d.type] || linkTypes.default;
            return config.color;
        })
        .attr('stroke-width', d => {
            const config = linkTypes[d.type] || linkTypes.default;
            return config.width;
        })
        .attr('marker-end', d => {
            const config = linkTypes[d.type] || linkTypes.default;
            return config.directed ? `url(#arrow-${d.type})` : null;
        })
        .on('click', handleLinkClick);

    // Draw nodes
    const node = g.append('g')
        .selectAll('g')
        .data(graphData.nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded))
        .on('click', handleNodeClick);

    node.append('circle')
        .attr('r', 14)
        .attr('fill', d => nodeColors[d.type] || nodeColors.default);

    node.append('text')
        .attr('class', 'node-label')
        .attr('dy', -20)
        .text(d => d.title.slice(0, 15));

    // Add tooltips
    node.append('title')
        .text(d => d.title);

    // Update positions on tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

function handleNodeClick(event, d) {
    event.stopPropagation();

    if (linkModeEnabled && selectedNodeForLink) {
        // Create new link - show dropdown to select type
        if (selectedNodeForLink.id !== d.id) {
            showLinkTypeModal(selectedNodeForLink, d);
        }
        selectedNodeForLink = null;
        d3.selectAll('.node').classed('selected', false);
    } else if (linkModeEnabled) {
        // Select node for linking
        selectedNodeForLink = d;
        d3.selectAll('.node').classed('selected', false);
        d3.select(event.currentTarget).classed('selected', true);
    } else {
        // Show detail panel
        showNodeDetail(d);
    }
}

function showLinkTypeModal(sourceNode, targetNode) {
    const $modal = $('#linkTypeModal');
    const $options = $('#linkTypeOptions');

    $options.empty();

    // Create option for each link type
    Object.keys(linkTypes).forEach(type => {
        if (type === 'default') return;

        const config = linkTypes[type];
        const $option = $(`
            <button class="link-type-option w-full p-3 rounded-lg border-2 hover:scale-105 transition-all text-right flex items-center gap-3"
                    data-type="${type}"
                    style="border-color: ${config.color}20; background: ${config.color}10;">
                <div class="w-4 h-4 rounded-full" style="background: ${config.color};"></div>
                <span class="font-semibold text-slate-800 dark:text-slate-200">${type}</span>
                <span class="text-xs text-slate-600 dark:text-slate-400 mr-auto">${config.directed ? '→' : '↔'}</span>
            </button>
        `);

        $option.on('click', function() {
            const selectedType = $(this).data('type');
            createConnection(sourceNode.id, targetNode.id, selectedType);
            $modal.addClass('hidden');
        });

        $options.append($option);
    });

    $modal.removeClass('hidden');
}

function createConnection(sourceId, targetId, type) {
    if (!currentDocId) {
        alert('خطا: شناسه کتاب یافت نشد');
        return;
    }

    const connection = saveConnection(currentDocId, sourceId, targetId, type);

    graphData.links.push({
        id: connection.id,
        source: sourceId,
        target: targetId,
        type: type,
        createdAt: connection.createdAt,
        userDefined: true
    });

    updateStats();
    renderGraph();
}

$('#cancelLinkType').on('click', function() {
    $('#linkTypeModal').addClass('hidden');
});

function handleLinkClick(event, d) {
    event.stopPropagation();

    if (!linkModeEnabled) {
        showLinkDetail(d);
    }
}

function showNodeDetail(node) {
    $('#detailTitle').text('جزئیات نود');
    $('#detailContent').html(`
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">شناسه:</div>
                    <div class="text-gray-900 dark:text-gray-200">${node.id}</div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">نوع:</div>
                    <div class="text-gray-900 dark:text-gray-200">${node.type}</div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">ترتیب:</div>
                    <div class="text-gray-900 dark:text-gray-200">#${node.order}</div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">متن کامل:</div>
                    <div class="text-gray-900 dark:text-gray-200 leading-relaxed">${node.fullText}</div>
                </div>
            `);
    $('#detailPanel').removeClass('hidden').addClass('block');
}

function showLinkDetail(link) {
    const sourceNode = graphData.nodes.find(n => n.id === link.source.id);
    const targetNode = graphData.nodes.find(n => n.id === link.target.id);
    const linkConfig = linkTypes[link.type] || linkTypes.default;

    const createdDate = link.createdAt ? new Date(link.createdAt).toLocaleString('fa-IR') : 'نامشخص';

    let deleteButton = '';
    if (link.userDefined && link.id) {
        deleteButton = `
            <button id="deleteLinkBtn" data-link-id="${link.id}"
                class="w-full mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 active:scale-95 transition-all">
                🗑️ حذف این یال
            </button>
        `;
    }

    $('#detailTitle').text('جزئیات یال');
    $('#detailContent').html(`
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">نوع:</div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background: ${linkConfig.color};"></div>
                        <span class="text-gray-900 dark:text-gray-200">${link.type}</span>
                        <span class="text-xs text-gray-600 dark:text-gray-400">${linkConfig.directed ? '(جهت‌دار →)' : '(دوطرفه ↔)'}</span>
                    </div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">از نود:</div>
                    <div class="text-gray-900 dark:text-gray-200">${sourceNode?.title || 'نامشخص'}</div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">به نود:</div>
                    <div class="text-gray-900 dark:text-gray-200">${targetNode?.title || 'نامشخص'}</div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">تاریخ ایجاد:</div>
                    <div class="text-gray-900 dark:text-gray-200">${createdDate}</div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">وضعیت:</div>
                    <div class="text-gray-900 dark:text-gray-200">${link.userDefined ? '✅ ایجاد شده توسط کاربر' : '🤖 پیش‌فرض سیستم'}</div>
                </div>
                ${deleteButton}
            `);
    $('#detailPanel').removeClass('hidden').addClass('block');
}

// Handle delete link button click
$(document).on('click', '#deleteLinkBtn', function() {
    const linkId = $(this).data('link-id');
    if (!confirm('آیا از حذف این یال مطمئن هستید؟')) return;

    if (deleteConnection(currentDocId, linkId)) {
        // Remove from graphData
        graphData.links = graphData.links.filter(l => l.id !== linkId);
        updateStats();
        renderGraph();
        $('#detailPanel').addClass('hidden');
        alert('یال با موفقیت حذف شد');
    } else {
        alert('خطا در حذف یال');
    }
});

$('#closeDetail').on('click', function () {
    $('#detailPanel').addClass('hidden').removeClass('block');
});

$('#linkToggle').on('click', function () {
    linkModeEnabled = !linkModeEnabled;
    const $toggle = $(this);
    const $dot = $toggle.find('span');

    if (linkModeEnabled) {
        $toggle.removeClass('bg-slate-300 dark:bg-slate-600').addClass('bg-blue-500');
        $dot.addClass('-translate-x-6');
    } else {
        $toggle.removeClass('bg-blue-500').addClass('bg-slate-300 dark:bg-slate-600');
        $dot.removeClass('-translate-x-6');
    }

    selectedNodeForLink = null;
    d3.selectAll('.node').classed('selected', false);
});

$('#refreshData').on('click', function () {
    loadDataFromStorage();
});

// Sync graph data with backend
$('#syncGraph').on('click', async function() {
    const $btn = $(this);
    const $icon = $btn.find('.sync-icon');
    const $text = $btn.find('.sync-text');
    const $spinner = $btn.find('.sync-spinner');

    const payload = {
        booksMeta,
        graphConnections
    };

    // Loading state
    $btn.prop('disabled', true).addClass('opacity-70 cursor-not-allowed');
    $spinner.removeClass('hidden');
    $icon.addClass('hidden');
    $text.text('در حال همگام‌سازی...');

    try {
        const res = await fetch('http://localhost:8000/sync_graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Sync failed');

        $text.text('همگام‌سازی شد ✅');
        setTimeout(() => { $text.text('همگام‌سازی گراف'); }, 1500);
    } catch (e) {
        console.error(e);
        alert('خطا در همگام‌سازی با بک‌اند');
        $text.text('خطا ❌');
        setTimeout(() => { $text.text('همگام‌سازی گراف'); }, 1500);
    } finally {
        $btn.prop('disabled', false).removeClass('opacity-70 cursor-not-allowed');
        $spinner.addClass('hidden');
        $icon.removeClass('hidden');
    }
});

// Drag functions
function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

// Handle window resize
window.addEventListener('resize', () => {
    if (simulation && graphData.nodes.length) {
        const { width, height } = getGraphDimensions();
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
    }
});

// Initialize
initializeTheme();
loadDataFromStorage();