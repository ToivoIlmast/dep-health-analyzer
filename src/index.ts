import { detectCycles } from './analyze/cycles';
import {
    createRealisticProjectGraph,
    createRealisticProjectGraphWithFullPaths,
    createSimpleSccGraph,
} from './fixtures/graph/graphs';
import { createGraph, addEdge } from './graph/build';
import type { ScanResult } from './graph/types';
import { discoverFiles } from './scanner/discover';
import { extractImports } from './scanner/extract';
import { resolveImport } from './scanner/resolve';

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

    // const mockGraph = createRealisticProjectGraphWithFullPaths();

    const cycles = detectCycles(graph);

    return {
        graph,
        scannedFiles: files.length,
        cycles,
    };
}
