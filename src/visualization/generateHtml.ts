import fs from 'node:fs';
import path from 'node:path';
import type { CytoscapeEdge, CytoscapeNode } from './adapters/buildCytoscapeElements';

type GraphElements = {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
};
export function generateHtml(graph: GraphElements): void {
    const { nodes, edges } = graph;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>dep-health graph</title>

    <script src="https://unpkg.com/cytoscape/dist/cytoscape.min.js"></script>

    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: sans-serif;
        }

        #cy {
            width: 100vw;
            height: 100vh;
        }

        #tooltip {
            position: absolute;
            display: none;
            padding: 8px 10px;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 12px;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            white-space: nowrap;
        }

        #hint {
            position: absolute;
            top: 16px;
            left: 16px;
            width: 260px;
        
            padding: 12px 14px;
        
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 8px;
        
            font-size: 13px;
            line-height: 1.5;
            color: #374151;
        
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        
            z-index: 999;
        }
    </style>
</head>

<body>
    <div id="cy"></div>
    <div id="tooltip"></div>
    <div id="hint">
        <strong>dep-health</strong><br /><br />

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

    <script>
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
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
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

            layout: {
                name: 'cose',
            },
        });

        const tooltip = document.getElementById('tooltip');

        if (!tooltip) {
            throw new Error('Tooltip element not found');
        }

        let pinnedNodeId = null;

        const highlightToggle = document.getElementById('highlight-toggle');

        let highlightEnabled = true;

        highlightToggle?.addEventListener('change', (event) => {
            highlightEnabled = event.target.checked;

            if (!highlightEnabled) {
                clearHighlights();
            }
        });

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

    fs.writeFileSync('dep-health-report.html', html);

    const reportPath = path.resolve('dep-health-report.html');
    console.log(
        `\nHTML report:\n\u001B]8;;file://${reportPath}\u0007dep-health-report.html\u001B]8;;\u0007`
    );
}
