import { ScanResult } from 'core/graph/types';
import path from 'node:path';
import { DependencyDelta } from '../types';

function normalizePath(file: string, root: string): string {
    return path.relative(root, file);
}

type Dependency = {
    from: string;
    to: string;
};

function buildDependencySet(scanResult: ScanResult, root: string): Set<string> {
    const dependencies = new Set<string>();

    for (const [from, deps] of scanResult.graph.edges.entries()) {
        const normalizedFrom = normalizePath(from, root);

        for (const to of deps) {
            const normalizedTo = normalizePath(to, root);

            dependencies.add(`${normalizedFrom}::${normalizedTo}`);
        }
    }

    return dependencies;
}

function parseDependency(key: string): Dependency {
    const [from, to] = key.split('::');

    return {
        from: from!,
        to: to!,
    };
}

export function calculateDependencyDelta(args: {
    current: ScanResult;
    baseline: ScanResult;
}): DependencyDelta {
    const { baseline, current } = args;

    const currentRoot = current.root;
    const baselineRoot = baseline.root;

    const currentDependencies = buildDependencySet(current, currentRoot);
    const baselineDependencies = buildDependencySet(baseline, baselineRoot);

    const added: Dependency[] = [];
    const removed: Dependency[] = [];

    for (const dependency of currentDependencies) {
        if (!baselineDependencies.has(dependency)) {
            added.push(parseDependency(dependency));
        }
    }

    for (const dependency of baselineDependencies) {
        if (!currentDependencies.has(dependency)) {
            removed.push(parseDependency(dependency));
        }
    }

    /* 
    getArea('src/features/regression/utils/createBaselineWorktree.ts', 4);

    const commonDepth1 = getCommonDepth('/A/B/C/D/index.ts', '/A/B/C/D/E/K/smt.tsx');
    console.log('Common Depth #1', commonDepth1);

    const commonDepth2 = getCommonDepth('/A/B/C/D/index.ts', '/A/I/C/D/E/K/smt.tsx');
    console.log('Common Depth #2', commonDepth2);

    const commonDepth3 = getCommonDepth('/A/B/C/D/index.ts', '/A/B/I/D/E/K/smt.tsx');
    console.log('Common Depth #3', commonDepth3);

    const commonDepth4 = getCommonDepth('/A/B/C/D/index.ts', '/A/B/C/I/E/K/smt.tsx');
    console.log('Common Depth #4', commonDepth4); 
    */

    return { added, removed };
}
