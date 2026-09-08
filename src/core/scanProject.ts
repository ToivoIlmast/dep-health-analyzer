import { createGraph, addEdge } from './graph/build';
import { ScanResult } from './graph/types';
import { discoverFiles } from './scanner/discover';
import { extractImports } from './scanner/extract';
import { loadTsConfig } from './scanner/loadTsConfig';
import { resolveImport } from './scanner/resolve';
import { minimatch } from 'minimatch';
import path from 'node:path';

type ScanProjectArgsType = {
    projectRoot: string;
    scanRoot: string;
    includeTypeOnlyImports?: boolean;
    exclude?: string[];
};

// `discoverFiles`'s `exclude` only keeps an excluded file from being
// scanned as a *source* of its own imports - it says nothing about a
// *resolved import target*. `resolve.ts`'s resolveFile() happily resolves
// any real file on disk regardless of discovery, so a file outside the
// excluded path that still imports something inside it (e.g. a stray
// relative import reaching into an excluded vendor/fixture directory)
// would otherwise add that excluded file back into the graph as a node,
// defeating the point of excluding it. Checked against the same
// root-relative path shape `resolveRegressionRules.ts` already uses for
// scope matching, with the same `{ nonegate: true }` minimatch option (see
// that file for why - a leading `!` must never silently invert to "matches
// everything").
function isExcludedPath(file: string, root: string, exclude: string[]): boolean {
    if (exclude.length === 0) {
        return false;
    }

    const relativePath = path.relative(root, file).replaceAll('\\', '/');

    return exclude.some((pattern) => minimatch(relativePath, pattern, { nonegate: true }));
}

export async function scanProject(args: ScanProjectArgsType): Promise<ScanResult> {
    const { projectRoot, scanRoot, includeTypeOnlyImports, exclude = [] } = args;
    const normalizedRoot = path.resolve(scanRoot);

    const files = await discoverFiles(normalizedRoot, exclude);
    const graph = createGraph();

    const tsconfig = loadTsConfig(projectRoot);

    for (const file of files) {
        graph.nodes.add(file);

        const imports = extractImports(file, { includeTypeOnlyImports });

        for (const specifier of imports) {
            const resolved = resolveImport({ fromFile: file, specifier, tsconfig });

            if (!resolved || isExcludedPath(resolved, normalizedRoot, exclude)) {
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
