import fs from 'node:fs';

type GraphElements = {
    nodes: unknown[];
    edges: unknown[];
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
    </style>
</head>

<body>
    <div id="cy"></div>

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
                    },
                },

                {
                    selector: 'edge',
                    style: {
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
                    },
                },
            ],

            layout: {
                name: 'cose',
            },
        });
    </script>
</body>
</html>
`;

    fs.writeFileSync('dep-health-report.html', html);

    console.log('HTML graph generated: dep-health-report.html');
}
