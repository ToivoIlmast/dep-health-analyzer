import { createGraph, addEdge } from './graph/build';
import { ScanResult } from './graph/types';
import { discoverFiles } from './scanner/discover';
import { extractImports } from './scanner/extract';
import { resolveImport } from './scanner/resolve';
import path from 'node:path';

export async function scanProject(root: string): Promise<ScanResult> {
    const normalizedRoot = path.resolve(root);

    const files = await discoverFiles(normalizedRoot);
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

    return {
        graph,
        scannedFiles: files.length,
        root: normalizedRoot,
    };
}
