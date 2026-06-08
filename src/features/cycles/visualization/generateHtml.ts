import fs from 'node:fs';
import path from 'node:path';
import type { CytoscapeEdge, CytoscapeNode } from '../adapters/buildCytoscapeElements';
import { buildHtmlTemplate } from './template';
import { copyAssets } from './copyAssets';

type GenerateHtmlArgs = {
    graph: {
        nodes: CytoscapeNode[];
        edges: CytoscapeEdge[];
    };
    outputPath: string;
};
export function generateHtml(args: GenerateHtmlArgs): void {
    const {
        graph: { nodes, edges },
        outputPath,
    } = args;

    const html = buildHtmlTemplate({ nodes, edges });

    const resolvedPath = path.resolve(outputPath);
    const directory = path.dirname(resolvedPath);

    fs.mkdirSync(directory, { recursive: true });
    copyAssets(directory);
    fs.writeFileSync(resolvedPath, html);

    console.log(
        `\nHTML report:\n\u001B]8;;file://${resolvedPath}\u0007${resolvedPath}\u001B]8;;\u0007`
    );
}
