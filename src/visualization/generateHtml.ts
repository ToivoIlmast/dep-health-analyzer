import fs from 'node:fs';
import path from 'node:path';
import type { CytoscapeEdge, CytoscapeNode } from './adapters/buildCytoscapeElements';
import { buildHtmlTemplate } from './template';

type GraphElements = {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
};
export function generateHtml(graph: GraphElements): void {
    const { nodes, edges } = graph;

    const html = buildHtmlTemplate({ nodes, edges });

    fs.writeFileSync('dep-health-analyzer-report.html', html);

    const reportPath = path.resolve('dep-health-analyzer-report.html');
    console.log(
        `\nHTML report:\n\u001B]8;;file://${reportPath}\u0007dep-health-analyzer-report.html\u001B]8;;\u0007`
    );
}
