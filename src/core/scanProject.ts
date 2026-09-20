import { createGraph, addEdge } from './graph/build';
import { ScanResult, UnresolvedImport } from './graph/types';
import { discoverFiles } from './scanner/discover';
import { extractImports } from './scanner/extract';
import { loadTsConfig } from './scanner/loadTsConfig';
import { resolveImport } from './scanner/resolve';
import { minimatch } from 'minimatch';
import fs from 'node:fs';
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

// `path.resolve()` is pure string arithmetic - it never touches the
// filesystem, so it doesn't collapse a symlink into its real target. On
// macOS, `os.tmpdir()` itself is a symlink (`/var/folders/...` ->
// `/private/var/folders/...`), and `process.chdir()`/`process.cwd()`
// resolve it at the OS level - so scanning the exact same directory via
// an absolute path (`path.resolve(root)`, symlink preserved) vs a
// relative one from inside it (`.`, resolved by chdir) previously
// produced two DIFFERENT sets of node ids for the identical files - the
// same "the path's form changes the result" defect class this file's own
// F3 fix already closed one instance of (resolveWorktreeTarget's
// absolute-vs-relative --target). realpathSync collapses both forms to
// the one real path first, so node identity depends only on which files
// exist, never on which of several equivalent spellings reached them.
// Falls back to the plain resolved path if it doesn't exist yet (a
// nonexistent target already scans 0 files today - a separate, known gap,
// not one this fix changes).
function resolveRealScanRoot(scanRoot: string): string {
    const resolved = path.resolve(scanRoot);

    try {
        return fs.realpathSync(resolved);
    } catch {
        return resolved;
    }
}

export async function scanProject(args: ScanProjectArgsType): Promise<ScanResult> {
    const { projectRoot, scanRoot, includeTypeOnlyImports, exclude = [] } = args;
    const normalizedRoot = resolveRealScanRoot(scanRoot);

    const files = await discoverFiles(normalizedRoot, exclude);
    const graph = createGraph();
    const unresolvedImports: UnresolvedImport[] = [];

    const tsconfig = loadTsConfig(projectRoot);

    for (const file of files) {
        graph.nodes.add(file);

        const imports = extractImports(file, { includeTypeOnlyImports });

        for (const specifier of imports) {
            const resolved = resolveImport({ fromFile: file, specifier, tsconfig });

            if (!resolved) {
                // A bare/external specifier (a real npm package, or an
                // unmatched tsconfig path alias) is the existing, intentional
                // "EXTERNAL SKIP" case (resolve.ts) - not a defect, and out
                // of scope here. Only a relative specifier that fails to
                // resolve is a genuine analysis gap worth surfacing.
                if (specifier.startsWith('.')) {
                    unresolvedImports.push({ file, specifier });
                }

                continue;
            }

            if (isExcludedPath(resolved, normalizedRoot, exclude)) {
                continue;
            }

            addEdge(graph, file, resolved);
        }
    }

    unresolvedImports.sort(
        (a, b) => a.file.localeCompare(b.file) || a.specifier.localeCompare(b.specifier)
    );

    return {
        graph,
        scannedFiles: files.length,
        root: normalizedRoot,
        unresolvedImports,
    };
}
