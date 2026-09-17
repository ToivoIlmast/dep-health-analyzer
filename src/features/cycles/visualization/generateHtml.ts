import fs from 'node:fs';
import path from 'node:path';
import type { UnresolvedImport } from '@core/graph/types';
import type { CytoscapeEdge, CytoscapeNode } from '../adapters/buildCytoscapeElements';
import type { CycleFindings } from '../findings/buildCycleFindings';
import { buildHtmlTemplate } from './template';
import { copyAssets } from './copyAssets';

type GenerateHtmlArgs = {
    graph: {
        nodes: CytoscapeNode[];
        edges: CytoscapeEdge[];
    };
    findings: CycleFindings;
    outputPath: string;
    unresolvedImports?: UnresolvedImport[];
};
export function generateHtml(args: GenerateHtmlArgs): void {
    const {
        graph: { nodes, edges },
        findings,
        outputPath,
        unresolvedImports,
    } = args;

    const html = buildHtmlTemplate({ nodes, edges, findings, unresolvedImports });

    const resolvedPath = path.resolve(outputPath);
    const directory = path.dirname(resolvedPath);

    fs.mkdirSync(directory, { recursive: true });
    copyAssets(directory);
    fs.writeFileSync(resolvedPath, html);

    console.log(
        `\nHTML report:\n\u001B]8;;file://${resolvedPath}\u0007${resolvedPath}\u001B]8;;\u0007`
    );
}
