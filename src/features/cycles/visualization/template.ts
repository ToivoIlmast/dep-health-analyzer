import { CytoscapeEdge, CytoscapeNode } from '../adapters';
import { styles } from './styles';

type BuildHtmlTemplate = {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
};

export function buildHtmlTemplate(args: BuildHtmlTemplate) {
    const { nodes, edges } = args;
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8" />
        <title>dep-health-analyzer graph</title>
    
        <script src="./assets/cytoscape.min.js"></script>
        <script src="./assets/dagre.min.js"></script>
        <script src="./assets/cytoscape-dagre.js"></script>
    
        <style>
            ${styles}
        </style>
    </head>
    
    <body>
        <div id="cy"></div>
        <div id="tooltip"></div>
        <div id="hint">
            <strong>dep-health-analyzer</strong><br /><br />
    
            Hover over a module to see dependency metrics.<br />
            Click a module <strong>to pin</strong> the tooltip.<br /><br />
    
            <strong>Ca</strong> — incoming dependencies<br />
            How many modules depend on this module.<br /><br />
    
            <strong>Ce</strong> — outgoing dependencies<br />
            How many modules this module depends on.<br /><br />
    
            <strong>Instability</strong><br />
            0.00 = stable module<br />
            1.00 = highly unstable module
            <br /><br />
    
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="highlight-toggle" checked />
                Highlight connected modules
            </label>
        </div>

        <div id="toolbar">
            <label>
                Layout:
                <select id="layout-select">
                    <option value="dagreLR">Dagre LR</option>
                    <option value="dagreTB">Dagre TB</option>
                    <option value="breadthfirst">Breadth First</option>
                    <option value="cose">Force Directed</option>
                </select>
            </label>

            <button id="fit-btn">
                Fit Graph
            </button>
        </div>
    
        <script>
            const layouts = {
                dagreLR: {
                    name: 'dagre',
                    rankDir: 'LR',
                    nodeSep: 60,
                    rankSep: 140,
                    edgeSep: 30,
                    padding: 40,
                    spacingFactor: 1.3,
                    fit: true,
                    nodeDimensionsIncludeLabels: true,
                },
            
                dagreTB: {
                    name: 'dagre',
                    rankDir: 'TB',
                    nodeSep: 60,
                    rankSep: 140,
                    edgeSep: 30,
                    padding: 40,
                    spacingFactor: 1.3,
                    fit: true,
                    nodeDimensionsIncludeLabels: true,
                },
            
                breadthfirst: {
                    name: 'breadthfirst',
                    directed: true,
                    fit: true,
                    padding: 40,
                },
            
                cose: {
                    name: 'cose',
                    animate: true,
                    fit: true,
                    padding: 40,
                },
            };

            cytoscape.use(cytoscapeDagre);

            const cy = cytoscape({
                container: document.getElementById('cy'),
    
                elements: {
                    nodes: ${JSON.stringify(nodes)},
                    edges: ${JSON.stringify(edges)},
                },
    
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(label)',
                            'font-size': '10px',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'background-color': 'gray',  
                            'width': 'data(size)',
                            'height': 'data(size)',
                            'opacity': '0.5',                  
                        },
                    },
    
                    {
                        selector: 'edge',
                        style: {
                            'curve-style': 'straight',
                            'target-arrow-shape': 'triangle',
                            'line-color': '#888',
                            'target-arrow-color': '#888',
                            'width': 1.5,
                        },
                    },
    
                    {
                        selector: '.scc',
                        style: {
                            'background-color': 'data(color)',
                            'width': 'data(size)',
                            'height': 'data(size)', 
                            'opacity': '1'
                        },
                    },
    
                    {
                        selector: '.faded',
                        style: {
                            'opacity': 0.4,
                        },
                    },
                    
                    {
                        selector: '.highlighted',
                        style: {
                            'opacity': 1,
                        },
                    },
                    
                    {
                        selector: '.highlighted-edge',
                        style: {
                            'line-color': '#f97316',
                            'target-arrow-color': '#f97316',
                            'width': 2.5,
                            'opacity': 1,
                        },
                    },
                ],
    
                layout: layouts.dagreLR,
            });

            const layoutSelect = document.getElementById('layout-select');

            if (layoutSelect) {
                layoutSelect.addEventListener(
                    'change',
                    function () {
                        cy.layout(
                            layouts[this.value],
                        ).run();

                        setTimeout(() => {
                            cy.fit(undefined, 80);
                        }, 300);
                    },
                );
            }

            const fitButton =
                document.getElementById(
                    'fit-btn',
                );

            if (fitButton) {
                fitButton.addEventListener(
                    'click',
                    function () {
                        cy.fit(undefined, 40);
                    },
                );
            }

            const tooltip = document.getElementById(
                    'tooltip',
                );

            if (!tooltip) {
                throw new Error(
                    'Tooltip element not found',
                );
            }

            let pinnedNodeId = null;

            const highlightToggle = document.getElementById('highlight-toggle');

            let highlightEnabled = true;

            highlightToggle?.addEventListener(
                'change',
                (event) => {
                    highlightEnabled =
                        event.target.checked;

                    if (!highlightEnabled) {
                        clearHighlights();
                    }
                },
            );
    
            function showTooltip(event) {
                const node = event.target;
                const data = node.data();
    
                const title = data.label || data.id;
                const showFullPath = title !== data.id;
    
                tooltip.innerHTML = \`
                    <strong>\${title}</strong>
    
                    \${showFullPath
                        ? \`<br />
                        <span style="color:#6b7280;font-size:11px;">
                            \${data.id}
                        </span>\`
                        : ''
                    }
                    <br /><br />
    
                    Ca: \${data.ca}<br />
                    Ce: \${data.ce}<br />
                    Instability: \${Number(data.instability).toFixed(2)}<br /><br />
    
                    SCC size: \${data.sccSize ?? 0}
                \`;
    
                tooltip.style.display = 'block';
            }
    
            function moveTooltip(event) {
                const { pageX, pageY } = event.originalEvent;
    
                tooltip.style.left = \`\${pageX + 12}px\`;
                tooltip.style.top = \`\${pageY + 12}px\`;
            }
    
            function clearHighlights() {
                cy.elements().removeClass('faded');
                cy.elements().removeClass('highlighted');
                cy.elements().removeClass('highlighted-edge');
            }
    
            function highlightNeighborhood(node) {
                clearHighlights();
    
                cy.elements().addClass('faded');
    
                node.removeClass('faded');
                node.addClass('highlighted');
    
                const connectedNodes = node.neighborhood('node');
                const connectedEdges = node.connectedEdges();
    
                connectedNodes.removeClass('faded');
                connectedNodes.addClass('highlighted');
    
                connectedEdges.removeClass('faded');
                connectedEdges.addClass('highlighted-edge');
            }
    
            cy.on('mouseover', 'node', (event) => {
                if (pinnedNodeId) {
                    return;
                }
    
                const node = event.target;
    
                if (highlightEnabled) {
                    highlightNeighborhood(node);
                }
    
                showTooltip(event);
            });
    
            cy.on('mousemove', 'node', (event) => {
                if (pinnedNodeId) {
                    return;
                }
    
                moveTooltip(event);
            });
    
            cy.on('mouseout', 'node', () => {
                if (pinnedNodeId) {
                    return;
                }
    
                clearHighlights();
    
                tooltip.style.display = 'none';
            });
    
            cy.on('tap', 'node', (event) => {
                const node = event.target;
                const data = node.data();
    
                pinnedNodeId = data.id;
    
                if (highlightEnabled) {
                    highlightNeighborhood(node);
                }
    
                showTooltip(event);
                moveTooltip(event);
            });
    
            cy.on('tap', (event) => {
                if (event.target === cy) {
                    pinnedNodeId = null;
    
                    clearHighlights();
    
                    tooltip.style.display = 'none';
                }
            });
        </script>
    </body>
    </html>
    `;
}
