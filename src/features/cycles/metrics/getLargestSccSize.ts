import { DependencyGraph } from '@core/graph/types';

function hasSelfLoop(node: string, graph: DependencyGraph): boolean {
    return graph.edges.get(node)?.has(node) ?? false;
}

/**
 * Kosaraju's algorithm (findSCCs) partitions every node into a component,
 * including "trivial" size-1 components for nodes that aren't part of any
 * real cycle - counting those would make "Largest SCC" report 1 even for a
 * project with zero circular dependencies. A size-1 component only counts
 * as a real cycle if that single node has a self-import (a genuine, if
 * unusual, cycle); every other size-1 component is excluded.
 */
export function getLargestSccSize(sccs: string[][], graph: DependencyGraph): number {
    let largest = 0;

    for (const scc of sccs) {
        const firstNode = scc[0];
        if (firstNode === undefined) {
            continue;
        }

        const isRealCycle = scc.length > 1 || hasSelfLoop(firstNode, graph);

        if (isRealCycle && scc.length > largest) {
            largest = scc.length;
        }
    }

    return largest;
}
