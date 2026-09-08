import path from 'node:path';
import { DependencyGraph } from '@core/graph/types';
import { ModuleMetrics } from '@features/cycles/metrics/types';

export type CytoscapeNode = {
    data: {
        id: string;
        label: string;
        dir: string;
        color?: string;
        typeColor: string;
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

// Experimental (branch: experiment/cycle-map-v2). A presentational grouping
// only - it classifies a node purely from data this adapter already has
// (its file path, and the Ca/Ce metrics already computed for it), so it
// changes nothing about how the graph, cycles, or metrics themselves are
// analyzed. The path patterns below match this project's own conventions
// (src/core, src/features, src/shared, scripts/) as well as the common
// convention most Node/TS projects follow for the same folder names -
// "correct" here means "a reasonable default that's transparent about
// being a heuristic", not a claim of true architectural intent, which
// only a human (or a real static-analysis feature, out of scope for this
// experiment) could actually determine.
const MODULE_TYPE_COLORS = {
    entry: '#3b82f6',
    core: '#22c55e',
    feature: '#a855f7',
    utility: '#9ca3af',
    tooling: '#f97316',
} as const;

type ModuleType = keyof typeof MODULE_TYPE_COLORS;

function classifyModuleType(relativePath: string, ca: number, ce: number): ModuleType {
    const normalized = relativePath.replaceAll('\\', '/').toLowerCase();

    if (/(^|\/)scripts\//.test(normalized)) {
        return 'tooling';
    }
    if (/(^|\/)(utils?|helpers?|shared|lib)\//.test(normalized)) {
        return 'utility';
    }
    if (/(^|\/)core\//.test(normalized)) {
        return 'core';
    }
    if (/(^|\/)features?\//.test(normalized)) {
        return 'feature';
    }
    // Nothing depends on it, but it depends on other things - a root of
    // the dependency graph (or of one of its disconnected components),
    // which is the closest thing to "entry point" derivable from data
    // already on hand, without hardcoding a specific filename like
    // 'cli.ts' or 'index.ts' that wouldn't generalize to other projects.
    if (ca === 0 && ce > 0) {
        return 'entry';
    }

    return 'utility';
}

type BuildNodes = {
    allNodes: Set<string>;
    sccs: string[][];
    metrics: Map<string, ModuleMetrics>;
    projectRoot?: string;
};
function buildNodes(args: BuildNodes): CytoscapeNode[] {
    const { allNodes, metrics, sccs, projectRoot } = args;

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
            sccIndex !== undefined ? defaultColors[sccIndex % defaultColors.length] : undefined;
        const ca = metrics.get(node)?.ca ?? 0;
        const ce = metrics.get(node)?.ce ?? 0;
        const degree = ca + ce;
        // Relative to the project root when one is available (real CLI
        // usage always provides it) so the second label line and the type
        // classification below read as "src/features/cycles", not some
        // long absolute filesystem path. Falls back to the raw id's own
        // directory otherwise - harmless for the synthetic single-letter
        // ids used in this file's own unit tests.
        const relativePath = projectRoot ? path.relative(projectRoot, node) : node;
        const dir = path.dirname(relativePath);
        const moduleType = classifyModuleType(relativePath, ca, ce);

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
                dir: dir === '.' ? '' : dir,
                color: color,
                typeColor: MODULE_TYPE_COLORS[moduleType],
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
    projectRoot?: string;
};

export function buildCytoscapeElements(args: BuildCytoscapeElements): {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
} {
    const { graph, metrics, sccs, projectRoot } = args;
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
        projectRoot,
    });
    const edges = buildEdges(graph.edges);

    return {
        nodes,
        edges,
    };
}
