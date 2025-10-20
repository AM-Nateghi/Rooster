// Global state
let graphData = { nodes: [], links: [] };
let entriesByTopic = {};
let currentBook = null;
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
        if (storedData) {
            entriesByTopic = JSON.parse(storedData);
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

    // Generate demo links based on order proximity
    graphData.links = [];
    for (let i = 0; i < graphData.nodes.length - 1; i++) {
        if (Math.random() > 0.3) {
            graphData.links.push({
                source: graphData.nodes[i].id,
                target: graphData.nodes[i + 1].id,
                type: 'ادامه متن'
            });
        }
    }

    // Add some random cross-references
    for (let i = 0; i < graphData.nodes.length; i++) {
        if (Math.random() > 0.7 && i < graphData.nodes.length - 2) {
            graphData.links.push({
                source: graphData.nodes[i].id,
                target: graphData.nodes[i + 2].id,
                type: Math.random() > 0.5 ? 'reference' : 'مثال'
            });
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
        // Create new link
        if (selectedNodeForLink.id !== d.id) {
            graphData.links.push({
                source: selectedNodeForLink.id,
                target: d.id,
                type: 'reference'
            });
            updateStats();
            renderGraph();
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

    $('#detailTitle').text('جزئیات یال');
    $('#detailContent').html(`
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">نوع:</div>
                    <div class="text-gray-900 dark:text-gray-200">${link.type}</div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">از نود:</div>
                    <div class="text-gray-900 dark:text-gray-200">${sourceNode?.title || 'نامشخص'}</div>
                </div>
                <div>
                    <div class="font-semibold text-gray-700 dark:text-gray-400">به نود:</div>
                    <div class="text-gray-900 dark:text-gray-200">${targetNode?.title || 'نامشخص'}</div>
                </div>
            `);
    $('#detailPanel').removeClass('hidden').addClass('block');
}

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