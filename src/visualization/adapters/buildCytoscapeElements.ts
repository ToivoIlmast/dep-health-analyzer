import path from 'node:path';
import { DependencyGraph } from '../../graph/types';
import { ModuleMetrics } from '../../metrics/types';

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

const defaultColors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#0ea5e9',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#d946ef',
    '#ec4899',
    '#f43f5e',
    '#78716c',
    '#6b7280',
    '#64748b',
];

function collectAllNodes(graph: Map<string, Set<string>>): Set<string> {
    const allNodes = new Set<string>();

    for (const [from, neighbors] of graph.entries()) {
        allNodes.add(from);

        for (const to of neighbors) {
            allNodes.add(to);
        }
    }

    return allNodes;
}

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
                label: degree > 3 ? path.basename(node) : '',
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
    const realSccs = sccs.filter((scc) => scc.length > 2);

    const allNodes = collectAllNodes(graph.edges);
    const nodes = buildNodes({
        allNodes,
        metrics,
        sccs: realSccs,
    });
    const edges = buildEdges(graph.edges);

    return {
        nodes,
        edges,
    };
}
