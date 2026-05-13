import { detectCycles } from './analyze/cycles';
import { createGraph, addEdge } from './graph/build';
import type { ScanResult } from './graph/types';
import { findSCCs } from './metrics/findScc';
import { discoverFiles } from './scanner/discover';
import { extractImports } from './scanner/extract';
import { resolveImport } from './scanner/resolve';
import { buildCytoscapeElements } from './visualization/adapters';
import { generateHtml } from './visualization/generateHtml';

export async function scanProject(root: string): Promise<ScanResult> {
    const files = await discoverFiles(root);
    const graph = createGraph();

    for (const file of files) {
        graph.nodes.add(file);

        const imports = extractImports(file);

        for (const specifier of imports) {
            const resolved = resolveImport(file, specifier);

            if (!resolved) {
                continue;
            }

            addEdge(graph, file, resolved);
        }
    }

    const cycles = detectCycles(graph);
    console.log('Graph', graph.edges);
    const sccs = findSCCs(graph.edges);
    const graph1 = new Map<string, Set<string>>([
        ['A', new Set(['B'])],
        ['B', new Set(['C'])],
        ['C', new Set(['A', 'D'])],

        ['D', new Set(['E'])],
        ['E', new Set(['F'])],
        ['F', new Set(['D'])],

        ['G', new Set(['H'])],
        ['H', new Set([])],
    ]);

    const elements = buildCytoscapeElements(graph.edges);
    generateHtml(elements);

    return {
        graph,
        scannedFiles: files.length,
        cycles,
    };
}
