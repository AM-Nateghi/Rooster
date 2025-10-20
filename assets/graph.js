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
let nodePositions = {}; // Store node positions to preserve them between renders
let hoverTimer = null; // Timer for showing tooltip on hover

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

// Link type configurations with unique 4-digit IDs starting from 3141
const linkTypes = {
    reference: { id: 3141, color: '#3b82f6', directed: true, width: 2 },
    'ارتباط علی': { id: 3142, color: '#8b5cf6', directed: true, width: 2.5 },
    'ادامه متن': { id: 3143, color: '#06b6d4', directed: true, width: 2 },
    'مثال': { id: 3144, color: '#10b981', directed: false, width: 2 },
    'بیشتر بدانیم': { id: 3145, color: '#f59e0b', directed: false, width: 2 },
    'زیرمجموعه مطلب': { id: 3146, color: '#ec4899', directed: true, width: 2.5 },
    default: { id: 3147, color: '#64748b', directed: true, width: 1.5 }
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

// Arrow markers for directed edges using numeric IDs
const linkTypeMapping = {};
svg.append('defs').selectAll('marker')
    .data(Object.keys(linkTypes).filter(k => linkTypes[k].directed))
    .enter().append('marker')
    .attr('id', d => {
        const config = linkTypes[d] || linkTypes.default;
        const markerId = `arrow-${config.id}`;
        linkTypeMapping[d] = markerId; // Store mapping original -> numeric ID
        return markerId;
    })
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 18)  // node radius (14) + stroke (2) + arrow tip (2)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4L2,0Z')  // فلش کوچکتر و دقیق‌تر
    .attr('fill', d => linkTypes[d]?.color || linkTypes.default.color)
    .style('stroke', 'none');

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
        const nodeIds = graphData.nodes.map(n => n.id);

        // Validate connections (removes invalid ones)
        validateConnections(currentDocId, nodeIds);

        // Reload validated connections
        const connections = loadConnections(currentDocId);

        // Convert connections to link format
        graphData.links = connections.map(conn => ({
            id: conn.id,
            source: conn.source,
            target: conn.target,
            type: conn.type,
            createdAt: conn.createdAt,
            userDefined: conn.userDefined
        }));

        // Warn about cleaned connections
        const cleanedCount = connections.length - graphData.links.length;
        if (cleanedCount > 0) {
            console.warn(`⚠️ Removed ${cleanedCount} invalid connection(s) with missing nodes`);
        }
    }

    updateStats();
    renderGraph();
}

function updateStats() {
    $('#nodeCount').text(graphData.nodes.length);
    $('#linkCount').text(graphData.links.length);
}

function renderGraph() {
    // Stop previous simulation if it exists
    if (simulation) {
        // Save current positions before stopping
        simulation.nodes().forEach(n => {
            nodePositions[n.id] = { x: n.x, y: n.y, vx: n.vx, vy: n.vy };
        });
        simulation.stop();
    }

    g.selectAll('*').remove();
    $('#detailTooltip').addClass('hidden');
    selectedNodeForLink = null;

    if (!graphData.nodes.length) return;

    const { width, height } = getGraphDimensions();

    // Create fresh copy of nodes, preserving positions if they exist
    const nodes = graphData.nodes.map(n => {
        const saved = nodePositions[n.id];
        return {
            ...n,
            x: saved?.x || width / 2 + (Math.random() - 0.5) * 100,
            y: saved?.y || height / 2 + (Math.random() - 0.5) * 100,
            vx: saved?.vx || 0,
            vy: saved?.vy || 0
        };
    });

    // Create force simulation optimized for clustered graphs
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(graphData.links)
            .id(d => d.id)
            .distance(100)  // کلاسترها فشرده‌تر
            .strength(0.7))  // کشش قوی‌تر برای نگه داشتن کلاسترها
        .force('charge', d3.forceManyBody()
            .strength(-1200)  // دفع خیلی قوی برای جدا نگه داشتن نودها
            .distanceMax(500)  // محدوده تاثیر بزرگتر
            .theta(0.8))  // دقت بیشتر در محاسبات
        .force('center', d3.forceCenter(width / 2, height / 2)
            .strength(0.02))  // کشش خیلی ضعیف به مرکز
        .force('collision', d3.forceCollide()
            .radius(60)  // حباب برخورد خیلی بزرگ
            .strength(1)  // قدرت برخورد حداکثر
            .iterations(3))  // چند بار چک کردن برخورد
        .force('x', d3.forceX(width / 2).strength(0.005))
        .force('y', d3.forceY(height / 2).strength(0.005))
        .alphaDecay(0.01)  // خیلی کند آروم میشه
        .velocityDecay(0.4);  // اصطکاک متوسط

    // If was frozen, stop immediately
    if (isFrozen) {
        simulation.stop();
    }

    // Draw links
    const link = g.append('g')
        .selectAll('line')
        .data(graphData.links)
        .enter().append('line')
        .attr('class', d => {
            const config = linkTypes[d.type] || linkTypes.default;
            return config.directed ? 'link' : 'link undirected';
        })
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
            if (!config.directed) return null;

            // Use numeric marker ID (e.g., arrow-3141, arrow-3142, ...)
            const markerId = linkTypeMapping[d.type] || `arrow-${config.id}`;
            return `url(#${markerId})`;
        })
        .on('click', handleLinkClick)
        .on('mouseenter', function(event, d) {
            if (linkModeEnabled) return;

            // Clear any existing timer
            if (hoverTimer) clearTimeout(hoverTimer);

            // Show tooltip after 0.8s
            hoverTimer = setTimeout(() => {
                showLinkDetail(d, event);
            }, 800);
        })
        .on('mouseleave', function() {
            // Clear timer if mouse leaves before timeout
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
        });

    // Draw nodes
    const node = g.append('g')
        .selectAll('g')
        .data(nodes)
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

    // Add hover handlers
    node.on('mouseenter', function(event, d) {
        if (linkModeEnabled) return;

        // Clear any existing timer
        if (hoverTimer) clearTimeout(hoverTimer);

        // Show tooltip after 0.8s
        hoverTimer = setTimeout(() => {
            showNodeDetail(d, event);
        }, 800);
    })
    .on('mouseleave', function() {
        // Clear timer if mouse leaves before timeout
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
    });

    // Update positions on tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x || 0)
            .attr('y1', d => d.source.y || 0)
            .attr('x2', d => d.target.x || 0)
            .attr('y2', d => d.target.y || 0);

        node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
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
        // Show tooltip immediately on click
        showNodeDetail(d, event);
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

    // Verify both nodes exist
    const sourceNode = graphData.nodes.find(n => n.id === sourceId);
    const targetNode = graphData.nodes.find(n => n.id === targetId);

    if (!sourceNode || !targetNode) {
        alert('خطا: یکی از نودها یافت نشد. لطفا صفحه را بارگذاری مجدد کنید.');
        console.error('Missing nodes:', { sourceId, targetId, sourceNode, targetNode });
        return;
    }

    // Save connection to localStorage
    const connection = saveConnection(currentDocId, sourceId, targetId, type);

    // Reload connections from localStorage to ensure consistency
    const connections = loadConnections(currentDocId);

    // Rebuild links array from scratch
    graphData.links = connections.map(conn => ({
        id: conn.id,
        source: conn.source,  // Keep as ID string, D3 will convert it
        target: conn.target,  // Keep as ID string, D3 will convert it
        type: conn.type,
        createdAt: conn.createdAt,
        userDefined: conn.userDefined
    }));

    updateStats();

    // Re-render with minimal disruption
    renderGraph();

    // Reduce alpha to minimize movement after adding link
    if (simulation) {
        simulation.alpha(0.3).restart();
    }
}

$('#cancelLinkType').on('click', function() {
    $('#linkTypeModal').addClass('hidden');
});

function handleLinkClick(event, d) {
    event.stopPropagation();

    if (!linkModeEnabled) {
        showLinkDetail(d, event);
    }
}

function showNodeDetail(node, event) {
    const $tooltip = $('#detailTooltip');

    $('#detailTitle').text('جزئیات نود');
    $('#detailContent').html(`
        <div>
            <div class="font-semibold">شناسه:</div>
            <div class="text-gray-900">${node.id}</div>
        </div>
        <div>
            <div class="font-semibold">نوع:</div>
            <div class="text-gray-900">${node.type}</div>
        </div>
        <div>
            <div class="font-semibold">ترتیب:</div>
            <div class="text-gray-900">#${node.order}</div>
        </div>
        <div>
            <div class="font-semibold">متن کامل:</div>
            <div class="text-gray-900 leading-relaxed">${node.fullText}</div>
        </div>
    `);

    // Position tooltip near the mouse cursor
    positionTooltip($tooltip, event);

    $tooltip.removeClass('hidden');
}

function showLinkDetail(link, event) {
    // Handle both cases: before and after D3 processes the link
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    const sourceNode = graphData.nodes.find(n => n.id === sourceId);
    const targetNode = graphData.nodes.find(n => n.id === targetId);
    const linkConfig = linkTypes[link.type] || linkTypes.default;

    const createdDate = link.createdAt ? new Date(link.createdAt).toLocaleString('fa-IR') : 'نامشخص';

    let deleteButton = '';
    if (link.userDefined && link.id) {
        deleteButton = `
            <button id="deleteLinkBtn" data-link-id="${link.id}"
                class="inline-block px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 active:scale-95 transition-all float-left">
                🗑️ حذف
            </button>
        `;
    }

    const $tooltip = $('#detailTooltip');

    $('#detailTitle').text('جزئیات یال');
    $('#detailContent').html(`
        <div>
            <div class="font-semibold">نوع:</div>
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background: ${linkConfig.color};"></div>
                <span class="text-gray-900">${link.type}</span>
                <span class="text-xs text-gray-600 dark:text-gray-400">${linkConfig.directed ? '(جهت‌دار →)' : '(دوطرفه ↔)'}</span>
            </div>
        </div>
        <div>
            <div class="font-semibold">از نود:</div>
            <div class="text-gray-900">${sourceNode?.title || 'نامشخص'}</div>
        </div>
        <div>
            <div class="font-semibold">به نود:</div>
            <div class="text-gray-900">${targetNode?.title || 'نامشخص'}</div>
        </div>
        <div>
            <div class="font-semibold">تاریخ ایجاد:</div>
            <div class="text-gray-900">${createdDate}</div>
        </div>
        <div>
            <div class="font-semibold">وضعیت:</div>
            <div class="text-gray-900">${link.userDefined ? '✅ ایجاد شده توسط کاربر' : '🤖 پیش‌فرض سیستم'}</div>
        </div>
        <div class="mt-3 clearfix">
            ${deleteButton}
        </div>
    `);

    // Position tooltip near the mouse cursor
    positionTooltip($tooltip, event);

    $tooltip.removeClass('hidden');
}

// Helper function to position tooltip near cursor
function positionTooltip($tooltip, event) {
    const mouseX = event.pageX || event.clientX;
    const mouseY = event.pageY || event.clientY;
    const offset = 15;

    // Get tooltip dimensions
    $tooltip.removeClass('hidden');
    const tooltipWidth = $tooltip.outerWidth();
    const tooltipHeight = $tooltip.outerHeight();

    // Get viewport dimensions
    const viewportWidth = $(window).width();
    const viewportHeight = $(window).height();

    // Calculate position (default: right and below cursor)
    let left = mouseX + offset;
    let top = mouseY + offset;

    // Adjust if tooltip goes off-screen to the right
    if (left + tooltipWidth > viewportWidth - 20) {
        left = mouseX - tooltipWidth - offset;
    }

    // Adjust if tooltip goes off-screen to the bottom
    if (top + tooltipHeight > viewportHeight - 20) {
        top = mouseY - tooltipHeight - offset;
    }

    // Ensure tooltip doesn't go off-screen to the left or top
    left = Math.max(10, left);
    top = Math.max(10, top);

    $tooltip.css({ left: `${left}px`, top: `${top}px` });
}

// Handle delete link button click
$(document).on('click', '#deleteLinkBtn', function(e) {
    e.stopPropagation();

    const linkId = $(this).data('link-id');
    if (!confirm('آیا از حذف این یال مطمئن هستید؟')) return;

    if (deleteConnection(currentDocId, linkId)) {
        // Reload connections from localStorage
        const connections = loadConnections(currentDocId);

        // Rebuild links array from scratch
        graphData.links = connections.map(conn => ({
            id: conn.id,
            source: conn.source,
            target: conn.target,
            type: conn.type,
            createdAt: conn.createdAt,
            userDefined: conn.userDefined
        }));

        updateStats();
        renderGraph();
        $('#detailTooltip').addClass('hidden');
        alert('یال با موفقیت حذف شد');
    } else {
        alert('خطا در حذف یال');
    }
});

// Click outside tooltip to close
$(document).on('click', function(e) {
    const $tooltip = $('#detailTooltip');

    // If tooltip is visible and click is outside tooltip
    if (!$tooltip.hasClass('hidden') && !$tooltip.is(e.target) && $tooltip.has(e.target).length === 0) {
        $tooltip.addClass('hidden');
    }
});

// Prevent tooltip clicks from closing it
$('#detailTooltip').on('click', function(e) {
    e.stopPropagation();
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

// Freeze/unfreeze simulation
let isFrozen = false;
$('#freezeToggle').on('click', function() {
    isFrozen = !isFrozen;
    const $btn = $(this);

    if (isFrozen) {
        if (simulation) {
            simulation.stop();
        }
        $btn.text('🔥 آزاد کردن').removeClass('bg-purple-500 hover:bg-purple-600').addClass('bg-orange-500 hover:bg-orange-600');
    } else {
        if (simulation) {
            simulation.alpha(0.3).restart();
        }
        $btn.text('❄️ ثابت کردن').removeClass('bg-orange-500 hover:bg-orange-600').addClass('bg-purple-500 hover:bg-purple-600');
    }
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