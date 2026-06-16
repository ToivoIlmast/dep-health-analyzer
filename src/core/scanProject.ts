import { createGraph, addEdge } from './graph/build';
import { ScanResult } from './graph/types';
import { discoverFiles } from './scanner/discover';
import { extractImports } from './scanner/extract';
import { loadTsConfig } from './scanner/loadTsConfig';
import { resolveImport } from './scanner/resolve';
import path from 'node:path';

type ScanProjectArgsType = {
    projectRoot: string;
    scanRoot: string;
};

export async function scanProject(args: ScanProjectArgsType): Promise<ScanResult> {
    const { projectRoot, scanRoot } = args;
    const normalizedRoot = path.resolve(scanRoot);

    const files = await discoverFiles(normalizedRoot);
    const graph = createGraph();

    const tsconfig = loadTsConfig(projectRoot);

    for (const file of files) {
        graph.nodes.add(file);

        const imports = extractImports(file);

        for (const specifier of imports) {
            const resolved = resolveImport({ fromFile: file, specifier, tsconfig });

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
