import { DependencyGraph } from '@core/graph/types';

// Single source of truth for "is this SCC a real, reportable cycle" -
// P1-1/P1-2 fix. Before this, three different call sites each re-derived
// their own version of this question (analyzeCycles.ts's cycle COUNT came
// from detectCycles()'s naive DFS back-edge enumeration, buildCycleFindings
// excluded every size-1 SCC unconditionally, buildCytoscapeElements did the
// same for the graph's own '.scc' class/sccId, while getLargestSccSize
// already had the correct self-loop-aware check but only for that one
// scalar) - so a self-loop (a file importing itself) could be counted as a
// cycle by the CLI's "Cycles detected" line and by "Largest SCC: 1
// module(s)", while being completely invisible in the findings list and the
// HTML graph, with no way for a reader to find what the CLI just told them
// to fail CI over. Kosaraju/findSCCs() partitions every node into a
// component, including "trivial" size-1 components for a node that isn't
// part of any real cycle at all - those must stay excluded. A size-1
// component only counts as a real cycle when that single node has a
// self-import (a genuine, if unusual, circular dependency); every other
// size-1 component is a non-cycle. A 2+-member component is always a real
// cycle by construction (strong connectivity guarantees at least one path
// back to every member).
export function hasSelfLoop(node: string, graph: DependencyGraph): boolean {
    return graph.edges.get(node)?.has(node) ?? false;
}

export function isRealCycleScc(scc: string[], graph: DependencyGraph): boolean {
    const firstNode = scc[0];

    if (firstNode === undefined) {
        return false;
    }

    return scc.length > 1 || hasSelfLoop(firstNode, graph);
}

// The one filtered view every consumer (CLI cycle count/exit code, the HTML
// summary, buildCycleFindings, buildCytoscapeElements' realSccs/sccId/
// sccSize/'.scc' class) must derive from - never a second, independently
// re-filtered copy. Preserves the input array's order (and therefore the
// index every consumer assigns as a real node's/finding's sccId), just
// dropping the non-cycle trivial components.
export function filterRealCycleSccs(sccs: string[][], graph: DependencyGraph): string[][] {
    return sccs.filter((scc) => isRealCycleScc(scc, graph));
}
