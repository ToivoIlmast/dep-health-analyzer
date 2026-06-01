import { ScanResult } from 'core/graph/types';
import path from 'node:path';
import { DependencyDelta } from '../types';

function normalizePath(file: string, root: string): string {
    return path.relative(root, file);
}

type Files = {
    baseline: ScanResult;
    current: ScanResult;
    baselineRoot: string;
    currentRoot: string;
};

type RemovedFiles = Files;
function removedFiles(args: RemovedFiles): Array<{ from: string; to: string }> {
    const { baseline, current, baselineRoot, currentRoot } = args;

    const removed: Array<{ from: string; to: string }> = [];
    for (const [from, deps] of baseline.graph.edges.entries()) {
        const normalizedFrom = normalizePath(from, baselineRoot);

        for (const to of deps) {
            const normalizedTo = normalizePath(to, baselineRoot);

            const currentDeps = current.graph.edges.get(path.resolve(currentRoot, normalizedFrom));

            const existsInCurrent = currentDeps?.has(path.resolve(currentRoot, normalizedTo));

            if (!existsInCurrent) {
                removed.push({
                    from: normalizedFrom,
                    to: normalizedTo,
                });
            }
        }
    }

    return removed;
}

type AddedFiles = Files;
function addedFiles(args: AddedFiles): Array<{ from: string; to: string }> {
    const { baseline, current, baselineRoot, currentRoot } = args;

    const added: Array<{ from: string; to: string }> = [];
    for (const [from, deps] of current.graph.edges.entries()) {
        const normalizedFrom = normalizePath(from, currentRoot);

        for (const to of deps) {
            const normalizedTo = normalizePath(to, currentRoot);

            const baselineDeps = baseline.graph.edges.get(
                path.resolve(baselineRoot, normalizedFrom)
            );

            const existsInBaseline = baselineDeps?.has(path.resolve(baselineRoot, normalizedTo));

            if (!existsInBaseline) {
                added.push({
                    from: normalizedFrom,
                    to: normalizedTo,
                });
            }
        }
    }

    return added;
}

export function calculateDependencyDelta(args: {
    current: ScanResult;
    baseline: ScanResult;
}): DependencyDelta {
    const { baseline, current } = args;

    const currentRoot = process.cwd();
    const baselineRoot = path.resolve('.dep-health-analyzer');

    const removed = removedFiles({ baseline, baselineRoot, current, currentRoot });
    const added = addedFiles({ baseline, baselineRoot, current, currentRoot });

    /* getArea('src/features/regression/utils/createBaselineWorktree.ts', 4);

    const commonDepth1 = getCommonDepth('/A/B/C/D/index.ts', '/A/B/C/D/E/K/smt.tsx');
    console.log('Common Depth #1', commonDepth1);

    const commonDepth2 = getCommonDepth('/A/B/C/D/index.ts', '/A/I/C/D/E/K/smt.tsx');
    console.log('Common Depth #2', commonDepth2);

    const commonDepth3 = getCommonDepth('/A/B/C/D/index.ts', '/A/B/I/D/E/K/smt.tsx');
    console.log('Common Depth #3', commonDepth3);

    const commonDepth4 = getCommonDepth('/A/B/C/D/index.ts', '/A/B/C/I/E/K/smt.tsx');
    console.log('Common Depth #4', commonDepth4); */

    return { added, removed };
}
