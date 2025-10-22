// Global state
let graphData = { nodes: [], links: [] };
let entriesByTopic = {};
let booksMeta = {};
let graphConnections = {};
let currentBook = null;
let currentDocId = null;
let editModeEnabled = false; // false = review mode, true = edit mode
let overviewModeEnabled = false; // Overview mode state
let showNodeId = false; // false = show title, true = show ID
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

// Generate consistent color for book name (for overview mode)
function getBookColor(bookName) {
    // Hash the book name to get a consistent number
    let hash = 0;
    for (let i = 0; i < bookName.length; i++) {
        hash = bookName.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert to hue (0-360)
    const hue = Math.abs(hash % 360);

    // Return HSL color with good saturation and lightness
    return `hsl(${hue}, 70%, 50%)`;
}

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

            // Try to restore previously selected book, otherwise select first book
            const savedBook = localStorage.getItem('currentGraphBook');
            const bookToSelect = (savedBook && entriesByTopic[savedBook]) ? savedBook : Object.keys(entriesByTopic)[0];

            if (bookToSelect) {
                selectBook(bookToSelect);
            }

            $('#emptyState').hide();
        } else {
            $('#emptyState').show();
        }
    } catch (err) {
        console.error('خطا در خواندن داده‌ها از localStorage:', err);
        toast.error('خطا در بارگذاری داده‌ها');
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
                            <span class="font-medium text-sm text-slate-800 dark:text-slate-100">${book}</span>
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

    // Save selected book to localStorage
    localStorage.setItem('currentGraphBook', book);

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
        order: e.order,
        depth: e.depth,
        book: book  // Add book reference for overview mode
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

function renderOverview() {
    // Collect all nodes from all books
    graphData.nodes = [];
    const allNodeIds = new Set();

    Object.keys(entriesByTopic).forEach(book => {
        const entries = entriesByTopic[book] || [];
        entries.forEach(e => {
            graphData.nodes.push({
                id: e.id,
                title: e.input.slice(0, 50) + (e.input.length > 50 ? '...' : ''),
                fullText: e.input,
                order: e.order,
                depth: e.depth,
                book: book  // Store book name for color coding
            });
            allNodeIds.add(e.id);
        });
    });

    // Collect all connections from all books
    graphData.links = [];
    Object.keys(graphConnections).forEach(docId => {
        const connections = graphConnections[docId] || [];
        connections.forEach(conn => {
            // Only include connections where both nodes exist
            if (allNodeIds.has(conn.source) && allNodeIds.has(conn.target)) {
                graphData.links.push({
                    id: conn.id,
                    source: conn.source,
                    target: conn.target,
                    type: conn.type,
                    createdAt: conn.createdAt,
                    userDefined: conn.userDefined
                });
            }
        });
    });

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

    // Create force simulation with clustering for overview mode
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(graphData.links)
            .id(d => d.id)
            .distance(100)
            .strength(0.7))
        .force('charge', d3.forceManyBody()
            .strength(-1200)
            .distanceMax(500)
            .theta(0.8))
        .force('center', d3.forceCenter(width / 2, height / 2)
            .strength(0.02))
        .force('collision', d3.forceCollide()
            .radius(60)
            .strength(1)
            .iterations(3))
        .force('x', d3.forceX(width / 2).strength(0.005))
        .force('y', d3.forceY(height / 2).strength(0.005))
        .alphaDecay(0.01)
        .velocityDecay(0.4);

    // Add clustering force in overview mode
    if (overviewModeEnabled) {
        // Get unique books and assign each a position in a circle
        const books = [...new Set(nodes.map(n => n.book))];
        const bookCount = books.length;
        const clusterRadius = Math.min(width, height) * 0.3; // Radius for book clusters

        // Create book positions in a circle around the center
        const bookPositions = {};
        books.forEach((book, i) => {
            const angle = (i / bookCount) * 2 * Math.PI;
            bookPositions[book] = {
                x: width / 2 + clusterRadius * Math.cos(angle),
                y: height / 2 + clusterRadius * Math.sin(angle)
            };
        });

        // Add radial force to pull nodes towards their book cluster
        simulation.force('cluster', d3.forceRadial(
            d => {
                // Each node is pulled towards its book's position
                return 0; // Distance from cluster center
            },
            d => bookPositions[d.book]?.x || width / 2,
            d => bookPositions[d.book]?.y || height / 2
        ).strength(0.3));

        // Stronger collision to keep clusters separate
        simulation.force('collision', d3.forceCollide()
            .radius(70)
            .strength(1.2)
            .iterations(4));
    }

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
        .on('mouseenter', function (event, d) {
            if (linkModeEnabled) return;

            // Clear any existing timer
            if (hoverTimer) clearTimeout(hoverTimer);

            // Show tooltip after 0.8s
            hoverTimer = setTimeout(() => {
                showLinkDetail(d, event);
            }, 800);
        })
        .on('mouseleave', function () {
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
        .attr('r', d => {
            // Size based on depth: 5 levels (1-5), 8px reduction per level
            if (d.depth !== undefined && d.depth !== null && d.depth >= 1) {
                const maxRadius = 45;  // depth = 1
                const reductionPerLevel = 8;
                const minRadius = 13;  // depth = 5+

                // Clamp depth to max 5 levels
                const effectiveDepth = Math.min(d.depth, 5);

                return Math.max(minRadius, maxRadius - ((effectiveDepth - 1) * reductionPerLevel));
            }
            return 14; // Default size for nodes without depth
        })
        .attr('fill', d => {
            // In overview mode, color by book; otherwise default color
            if (overviewModeEnabled && d.book) {
                return getBookColor(d.book);
            }
            return nodeColors.default;
        });

    // Add order number inside the circle
    node.append('text')
        .attr('class', 'node-order')
        .attr('dy', 5)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('pointer-events', 'none')
        .text(d => d.order || '');

    node.append('text')
        .attr('class', 'node-label')
        .attr('dy', -20)
        .text(d => {
            if (showNodeId) {
                // Show ID (truncate if too long)
                return d.id.length > 12 ? d.id.slice(0, 12) + '...' : d.id;
            } else {
                // Show title
                return d.title.slice(0, 15);
            }
        });

    // Add hover handlers
    node.on('mouseenter', function (event, d) {
        // In edit mode, don't show tooltip on hover for nodes (only on click)
        if (editModeEnabled) return;

        // Clear any existing timer
        if (hoverTimer) clearTimeout(hoverTimer);

        // Show tooltip after 0.8s
        hoverTimer = setTimeout(() => {
            showNodeDetail(d, event);
        }, 800);
    })
        .on('mouseleave', function () {
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

    if (editModeEnabled && selectedNodeForLink) {
        // Create new link - show dropdown to select type
        if (selectedNodeForLink.id !== d.id) {
            showLinkTypeModal(selectedNodeForLink, d);
        }
        selectedNodeForLink = null;
        d3.selectAll('.node').classed('selected', false);
    } else if (editModeEnabled) {
        // Select node for linking
        selectedNodeForLink = d;
        d3.selectAll('.node').classed('selected', false);
        d3.select(event.currentTarget).classed('selected', true);
    } else {
        // Review mode: Show tooltip immediately on click (only edit button works)
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
                <span class="font-semibold text-slate-800 dark:text-slate-100">${type}</span>
                <span class="text-xs text-slate-600 dark:text-slate-300 mr-auto">${config.directed ? '→' : '↔'}</span>
            </button>
        `);

        $option.on('click', function () {
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
        toast.error('خطا: شناسه کتاب یافت نشد');
        return;
    }

    // Verify both nodes exist
    const sourceNode = graphData.nodes.find(n => n.id === sourceId);
    const targetNode = graphData.nodes.find(n => n.id === targetId);

    if (!sourceNode || !targetNode) {
        toast.error('خطا: یکی از نودها یافت نشد. لطفا صفحه را بارگذاری مجدد کنید.');
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

$('#cancelLinkType').on('click', function () {
    $('#linkTypeModal').addClass('hidden');
});

function handleLinkClick(event, d) {
    event.stopPropagation();

    // Always show link detail (in review mode, action buttons won't work)
    showLinkDetail(d, event);
}

function showNodeDetail(node, event) {
    const $tooltip = $('#detailTooltip');

    // Truncate text to 300 characters
    const maxLength = 300;
    const displayText = node.fullText.length > maxLength
        ? node.fullText.substring(0, maxLength) + '...'
        : node.fullText;

    // Build book info HTML (show in overview mode)
    const bookInfo = overviewModeEnabled && node.book ? `
        <div class="flex items-center gap-2">
            <span class="inline-block w-3 h-3 rounded-full" style="background-color: ${getBookColor(node.book)};"></span>
            <span class="text-slate-800 dark:text-slate-200">${node.book}</span>
        </div>
    ` : '';

    $('#detailTitle').html(`
        <div class="flex items-center justify-between gap-2">
            <span>جزئیات نود</span>
            <div class="flex items-center gap-2">
                <div class="depth-input-wrapper">
                    <input type="number"
                           class="depth-input node-depth-input"
                           placeholder=" "
                           value="${node.depth || ''}"
                           data-node-id="${node.id}"
                           data-book="${overviewModeEnabled ? node.book : currentBook}"
                           min="1"
                           max="10">
                    <label class="depth-label">عمق</label>
                </div>
                <button class="editNodeBtn px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:scale-95 transition-all"
                    data-node-id="${node.id}"
                    data-book="${overviewModeEnabled ? node.book : currentBook}">
                    ✏️ ویرایش
                </button>
            </div>
        </div>
    `);

    $('#detailContent').html(`
        ${bookInfo ? `<div><div class="font-semibold">کتاب:</div>${bookInfo}</div>` : ''}
        <div>
            <div class="font-semibold">شناسه:</div>
            <div class="text-slate-800 dark:text-slate-200">${node.id}</div>
        </div>
        <div>
            <div class="font-semibold">خلاصه متن:</div>
            <div class="text-slate-800 dark:text-slate-200 leading-relaxed text-justify">${displayText}</div>
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

    let actionButtons = '';
    // Only show action buttons in edit mode AND if link is user-defined
    if (editModeEnabled && link.userDefined && link.id) {
        // Build custom dropdown button for link type change
        const currentTypeColor = (linkTypes[link.type] || linkTypes.default).color;

        const changeTypeDropdown = `
            <div class="relative inline-block">
                <button class="changeLinkTypeBtn px-2 py-1 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-1"
                    data-link-id="${link.id}"
                    data-current-type="${link.type}">
                    <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${currentTypeColor};"></span>
                    <span class="type-label">${link.type}</span>
                    <span class="text-[10px]">▼</span>
                </button>
            </div>
        `;

        // Add reverse button for directed links
        const reverseButton = linkConfig.directed ? `
            <button class="reverseLinkBtn px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:scale-95 transition-all"
                data-link-id="${link.id}">
                🔄 برعکس کردن
            </button>
        ` : '';

        actionButtons = `
            <div class="flex gap-2 items-center justify-between flex-wrap">
                <button class="deleteLinkBtn px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 active:scale-95 transition-all"
                    data-link-id="${link.id}">
                    🗑️ حذف
                </button>
                ${changeTypeDropdown}
                ${reverseButton}
            </div>
        `;
    } else if (!editModeEnabled && link.userDefined) {
        // Review mode: show message that edit mode is needed
        actionButtons = `
            <div class="text-xs text-slate-500 dark:text-slate-400 italic">
                برای ویرایش یال، حالت ویرایش را فعال کنید
            </div>
        `;
    }

    const $tooltip = $('#detailTooltip');

    $('#detailTitle').text('جزئیات یال');
    $('#detailContent').html(`
        <div>
            <div class="font-semibold">نوع:</div>
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background: ${linkConfig.color};"></div>
                <span class="text-slate-800 dark:text-slate-200">${link.type}</span>
                <span class="text-xs text-slate-600 dark:text-slate-300">${linkConfig.directed ? '(جهت‌دار →)' : '(دوطرفه ↔)'}</span>
            </div>
        </div>
        <div>
            <div class="font-semibold">از نود:</div>
            <div class="text-slate-800 dark:text-slate-200">${sourceNode?.title || 'نامشخص'}</div>
        </div>
        <div>
            <div class="font-semibold">به نود:</div>
            <div class="text-slate-800 dark:text-slate-200">${targetNode?.title || 'نامشخص'}</div>
        </div>
        <div>
            <div class="font-semibold">تاریخ ایجاد:</div>
            <div class="text-slate-800 dark:text-slate-200">${createdDate}</div>
        </div>
        <div>
            <div class="font-semibold">وضعیت:</div>
            <div class="text-slate-800 dark:text-slate-200">${link.userDefined ? '✅ ایجاد شده توسط کاربر' : '🤖 پیش‌فرض سیستم'}</div>
        </div>
        <div class="mt-3 clearfix">
            ${actionButtons}
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
$(document).on('click', '.deleteLinkBtn', async function (e) {
    e.stopPropagation();

    const linkId = $(this).data('link-id');
    if (!await modal.confirm('آیا از حذف این یال مطمئن هستید؟', { title: 'تایید حذف یال' })) return;

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
        toast.success('یال با موفقیت حذف شد');
    } else {
        toast.error('خطا در حذف یال');
    }
});

// Handle change link type button click
$(document).on('click', '.changeLinkTypeBtn', function (e) {
    e.stopPropagation();

    const linkId = $(this).data('link-id');
    const currentType = $(this).data('current-type');
    const $btn = $(this);

    // Create dropdown menu
    const dropdownId = 'linkTypeDropdown';

    // Remove any existing dropdown
    $(`#${dropdownId}`).remove();

    // Build dropdown options
    const options = Object.keys(linkTypes)
        .filter(type => type !== 'default')
        .map(type => {
            const config = linkTypes[type];
            const isSelected = type === currentType;
            return `
                <div class="link-type-option px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-2 transition-colors ${isSelected ? 'bg-slate-200 dark:bg-slate-600' : ''}"
                    data-type="${type}"
                    data-link-id="${linkId}">
                    <span class="inline-block w-3 h-3 rounded-full" style="background-color: ${config.color};"></span>
                    <span class="text-xs text-slate-800 dark:text-slate-200 font-medium">${type}</span>
                    ${isSelected ? '<span class="mr-auto text-green-500">✓</span>' : ''}
                </div>
            `;
        })
        .join('');

    const dropdown = $(`
        <div id="${dropdownId}" class="absolute z-[9999] mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto min-w-[140px]">
            ${options}
        </div>
    `);

    // Position dropdown below button
    const btnOffset = $btn.offset();
    const btnHeight = $btn.outerHeight();

    dropdown.css({
        top: btnOffset.top + btnHeight + 4,
        left: btnOffset.left
    });

    $('body').append(dropdown);

    // Close dropdown when clicking outside
    setTimeout(() => {
        $(document).one('click', function () {
            dropdown.remove();
        });
    }, 10);
});

// Handle link type option selection
$(document).on('click', '.link-type-option', function (e) {
    e.stopPropagation();

    const linkId = $(this).data('link-id');
    const newType = $(this).data('type');

    if (!currentDocId) {
        toast.error('خطا: شناسه کتاب یافت نشد');
        return;
    }

    // Find the connection in graphConnections
    if (!graphConnections[currentDocId]) {
        toast.error('خطا: اتصالات یافت نشد');
        return;
    }

    const connectionIndex = graphConnections[currentDocId].findIndex(c => c.id === linkId);

    if (connectionIndex === -1) {
        toast.error('خطا: یال یافت نشد');
        return;
    }

    // Update the type
    graphConnections[currentDocId][connectionIndex].type = newType;

    // Save to localStorage
    localStorage.setItem("graphConnections", JSON.stringify(graphConnections));

    // Rebuild links array
    graphData.links = graphConnections[currentDocId].map(conn => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        type: conn.type,
        createdAt: conn.createdAt,
        userDefined: conn.userDefined
    }));

    updateStats();
    renderGraph();

    if (simulation) {
        simulation.alpha(0.3).restart();
    }

    $('#linkTypeDropdown').remove();
    $('#detailTooltip').addClass('hidden');
    toast.success('نوع یال با موفقیت تغییر کرد');
});

// Handle reverse link button click
$(document).on('click', '.reverseLinkBtn', function (e) {
    e.stopPropagation();

    const linkId = $(this).data('link-id');

    if (!currentDocId) {
        toast.error('خطا: شناسه کتاب یافت نشد');
        return;
    }

    // Find the connection in graphConnections
    if (!graphConnections[currentDocId]) {
        toast.error('خطا: اتصالات یافت نشد');
        return;
    }

    const connectionIndex = graphConnections[currentDocId].findIndex(c => c.id === linkId);

    if (connectionIndex === -1) {
        console.error('❌ Connection not found with ID:', linkId);
        console.log('Available connection IDs:', graphConnections[currentDocId].map(c => c.id));
        toast.error('خطا: یال یافت نشد');
        return;
    }

    // Reverse source and target
    const connection = graphConnections[currentDocId][connectionIndex];

    const tempSource = connection.source;
    connection.source = connection.target;
    connection.target = tempSource;

    // Update graphConnections global variable
    graphConnections[currentDocId][connectionIndex] = connection;

    // Save to localStorage
    localStorage.setItem("graphConnections", JSON.stringify(graphConnections));

    // Rebuild links array from updated graphConnections
    graphData.links = graphConnections[currentDocId].map(conn => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        type: conn.type,
        createdAt: conn.createdAt,
        userDefined: conn.userDefined
    }));

    updateStats();

    // Re-render with minimal disruption
    renderGraph();

    // Reduce alpha to minimize movement
    if (simulation) {
        simulation.alpha(0.3).restart();
    }

    toast.success('جهت یال با موفقیت برعکس شد');
});

// Handle depth input change in tooltip
$(document).on('change blur', '.node-depth-input', function () {
    const nodeId = $(this).data('node-id');
    const book = $(this).data('book');
    const depthValue = $(this).val();

    // Find the node in entriesByTopic
    if (entriesByTopic[book]) {
        const chunk = entriesByTopic[book].find(c => c.id === nodeId);
        if (chunk) {
            // Update or remove depth
            if (depthValue && parseInt(depthValue) >= 1) {
                chunk.depth = parseInt(depthValue);
            } else {
                delete chunk.depth;
            }

            // Save to localStorage
            localStorage.setItem('entriesByTopic', JSON.stringify(entriesByTopic));

            // Update the node in graphData
            const graphNode = graphData.nodes.find(n => n.id === nodeId);
            if (graphNode) {
                if (depthValue && parseInt(depthValue) >= 1) {
                    graphNode.depth = parseInt(depthValue);
                } else {
                    delete graphNode.depth;
                }

                // Update node size directly without re-rendering entire graph
                let newRadius;
                if (graphNode.depth !== undefined && graphNode.depth !== null && graphNode.depth >= 1) {
                    const maxRadius = 45;  // depth = 1
                    const reductionPerLevel = 8;
                    const minRadius = 13;  // depth = 5+

                    // Clamp depth to max 5 levels
                    const effectiveDepth = Math.min(graphNode.depth, 5);

                    newRadius = Math.max(minRadius, maxRadius - ((effectiveDepth - 1) * reductionPerLevel));
                } else {
                    newRadius = 14; // Default size for nodes without depth
                }

                // Update the circle radius using D3 and also update d.depth
                d3.selectAll('.node').each(function(d) {
                    if (d.id === nodeId) {
                        // Update the depth in the bound data
                        if (depthValue && parseInt(depthValue) >= 1) {
                            d.depth = parseInt(depthValue);
                        } else {
                            delete d.depth;
                        }

                        d3.select(this).select('circle')
                            .transition()
                            .duration(300)
                            .attr('r', newRadius);
                    }
                });
            }

            // Don't show toast - it's too noisy
        }
    }
});

// Handle edit node button click
$(document).on('click', '.editNodeBtn', function (e) {
    e.stopPropagation();

    const nodeId = $(this).data('node-id');
    const book = $(this).data('book');

    // Save edit request to localStorage
    localStorage.setItem('pendingEdit', JSON.stringify({
        book: book,
        chunkId: nodeId,
        timestamp: Date.now()
    }));

    // Navigate to main page
    window.location.href = '/';
});

// Click outside tooltip to close
$(document).on('click', function (e) {
    const $tooltip = $('#detailTooltip');

    // If tooltip is visible and click is outside tooltip (and not on a button inside it)
    if (!$tooltip.hasClass('hidden') &&
        !$tooltip.is(e.target) &&
        $tooltip.has(e.target).length === 0) {
        $tooltip.addClass('hidden');
    }
});

$('#linkToggle').on('click', function () {
    editModeEnabled = !editModeEnabled;
    const $toggle = $(this);
    const $dot = $toggle.find('span');
    const $label = $('.edit-mode-label');

    if (editModeEnabled) {
        $toggle.removeClass('bg-slate-300 dark:bg-slate-600').addClass('bg-green-500');
        $dot.addClass('-translate-x-6');
        $label.text('حالت ویرایش');
    } else {
        $toggle.removeClass('bg-green-500').addClass('bg-slate-300 dark:bg-slate-600');
        $dot.removeClass('-translate-x-6');
        $label.text('حالت بازبینی');
    }

    selectedNodeForLink = null;
    d3.selectAll('.node').classed('selected', false);

    // Hide tooltip when switching modes
    $('#detailTooltip').addClass('hidden');
});

$('#overviewToggle').on('click', function () {
    overviewModeEnabled = !overviewModeEnabled;
    const $toggle = $(this);
    const $dot = $toggle.find('span');
    const $bookList = $('#bookList');

    if (overviewModeEnabled) {
        // Enable overview mode
        $toggle.removeClass('bg-slate-300 dark:bg-slate-600').addClass('bg-green-500');
        $dot.addClass('-translate-x-6');

        // Disable book selection
        $('.book-item').addClass('opacity-50 pointer-events-none');

        // Render overview
        renderOverview();
    } else {
        // Disable overview mode
        $toggle.removeClass('bg-green-500').addClass('bg-slate-300 dark:bg-slate-600');
        $dot.removeClass('-translate-x-6');

        // Enable book selection
        $('.book-item').removeClass('opacity-50 pointer-events-none');

        // Return to selected book view
        if (currentBook && entriesByTopic[currentBook]) {
            selectBook(currentBook);
        } else {
            // If no book was selected, select the first one
            const firstBook = Object.keys(entriesByTopic)[0];
            if (firstBook) {
                selectBook(firstBook);
            }
        }
    }
});

$('#refreshData').on('click', function () {
    const wasOverviewMode = overviewModeEnabled;
    loadDataFromStorage();

    // Restore overview mode if it was active
    if (wasOverviewMode) {
        // Need to wait for loadDataFromStorage to complete
        setTimeout(() => {
            if (!overviewModeEnabled) {
                // Manually trigger overview mode
                $('#overviewToggle').click();
            }
        }, 100);
    }
});

// Freeze/unfreeze simulation
let isFrozen = false;
$('#freezeToggle').on('click', function () {
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

// Update only labels without re-rendering entire graph
function updateLabelsOnly() {
    // Update all node labels
    g.selectAll('.node-label')
        .text(d => {
            if (showNodeId) {
                // Show ID (truncate if too long)
                return d.id.length > 12 ? d.id.slice(0, 12) + '...' : d.id;
            } else {
                // Show title
                return d.title.slice(0, 15);
            }
        });
}

// Toggle label mode (ID vs Title)
$('#labelToggle').on('click', function () {
    showNodeId = !showNodeId;
    const $btn = $(this);

    // Update button text to show what will happen on NEXT click
    if (showNodeId) {
        // Currently showing IDs, next click will show titles
        $btn.text('🏷️ نمایش عنوان');
    } else {
        // Currently showing titles, next click will show IDs
        $btn.text('🆔 نمایش آیدی');
    }

    // Update labels WITHOUT moving nodes
    updateLabelsOnly();
});

// Sync graph data with backend
$('#syncGraph').on('click', async function () {
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
        const res = await fetch('/sync_graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Sync failed');

        $text.text('همگام‌سازی شد ✅');
        setTimeout(() => { $text.text('همگام‌سازی گراف'); }, 1500);
    } catch (e) {
        console.error(e);
        toast.error('خطا در همگام‌سازی با بک‌اند');
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