import path from 'node:path';
import { DependencyGraph } from '@core/graph/types';
import { ModuleMetrics } from '@features/cycles/metrics/types';

export type CytoscapeNode = {
    data: {
        id: string;
        label: string;
        color?: string;
        size?: number;
        ce?: number;
        ca?: number;
        instability?: number;
        sccSize?: number;
    };
    classes?: string;
};

export type CytoscapeEdge = {
    data: {
        source: string;
        target: string;
    };
};

// A qualitative/categorical palette (ColorBrewer's "Dark2" set), not an
// ordinal one - deliberately NOT a red-to-green ramp. `defaultColors[0]`
// being reached first (the first SCC `findSCCs()` happens to return) must
// not read as "the worst cycle" and a later index as "a milder one": which
// index a given SCC gets depends only on iteration order, not on size,
// severity, or how many real problems it represents. Distinguishing
// multiple simultaneous cycles from each other only needs colors humans
// can tell apart, not colors that imply a ranking between them.
const defaultColors = [
    '#1b9e77',
    '#d95f02',
    '#7570b3',
    '#e7298a',
    '#66a61e',
    '#e6ab02',
    '#a6761d',
    '#666666',
];

type BuildNodes = {
    allNodes: Set<string>;
    sccs: string[][];
    metrics: Map<string, ModuleMetrics>;
};
function buildNodes(args: BuildNodes): CytoscapeNode[] {
    const { allNodes, metrics, sccs } = args;

    const nodes: CytoscapeNode[] = [];

    const sccMap = new Map<string, number>();
    const sccSizeMap = new Map<string, number>();

    sccs.forEach((scc, index) => {
        for (const node of scc) {
            sccMap.set(node, index);
            sccSizeMap.set(node, scc.length);
        }
    });

    for (const node of allNodes) {
        const sccIndex = sccMap.get(node);
        const color =
            sccIndex !== undefined ? defaultColors[sccIndex % defaultColors.length] : '#9ca3af';
        const ca = metrics.get(node)?.ca ?? 0;
        const ce = metrics.get(node)?.ce ?? 0;
        const degree = ca + ce;
        nodes.push({
            data: {
                id: node,
                // Always a short, real filename - not gated behind a degree
                // threshold. Isolated/low-degree files used to render with
                // no label at all (confirmed on real fixtures: most nodes
                // in a normal-sized project have degree <= 3), leaving the
                // reader unable to tell what most of the graph even was
                // without hovering every single node one at a time.
                label: path.basename(node),
                color: color,
                size: 20 + Math.log2(degree + 1) * 18,
                ce,
                ca,
                instability: metrics.get(node)?.instability ?? 0,
                sccSize: sccSizeMap.get(node) ?? 0,
            },
            classes: sccMap.get(node) !== undefined ? 'scc' : '',
        });
    }

    return nodes;
}

function buildEdges(graph: Map<string, Set<string>>): CytoscapeEdge[] {
    const edges: CytoscapeEdge[] = [];

    for (const [from, neighbors] of graph.entries()) {
        for (const to of neighbors) {
            edges.push({
                data: {
                    source: from,
                    target: to,
                },
            });
        }
    }

    return edges;
}

type BuildCytoscapeElements = {
    graph: DependencyGraph;
    sccs: string[][];
    metrics: Map<string, ModuleMetrics>;
};

export function buildCytoscapeElements(args: BuildCytoscapeElements): {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
} {
    const { graph, metrics, sccs } = args;
    // findSCCs() (Kosaraju) returns a trivial size-1 "component" for every
    // node that isn't part of any real cycle - that's not a cycle and must
    // stay filtered out. But a real, honest cycle needs only 2 nodes
    // (A <-> B is the single most common real-world case - a direct
    // circular import), and `> 2` here was silently treating those exactly
    // like ordinary nodes: no color, no `.scc` class, nothing - even
    // though the CLI's own "Cycles detected"/"Largest SCC" output correctly
    // reported them. A 2-node SCC is still a real cycle; only a 1-node one
    // is the non-cycle case that needs excluding.
    const realSccs = sccs.filter((scc) => scc.length > 1);

    const nodes = buildNodes({
        // graph.nodes tracks every scanned file, including ones with zero
        // imports and zero importers - deriving the node set from
        // graph.edges instead (as this used to) silently drops those, since
        // addEdge only creates an edges-map entry for a file that has at
        // least one resolvable import.
        allNodes: graph.nodes,
        metrics,
        sccs: realSccs,
    });
    const edges = buildEdges(graph.edges);

    return {
        nodes,
        edges,
    };
}
