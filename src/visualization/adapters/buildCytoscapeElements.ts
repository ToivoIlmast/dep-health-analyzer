import path from 'node:path';

export type CytoscapeNode = {
    data: {
        id: string;
        label: string;
    };
};

export type CytoscapeEdge = {
    data: {
        source: string;
        target: string;
    };
};

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

function buildNodes(allNodes: Set<string>): CytoscapeNode[] {
    const nodes: CytoscapeNode[] = [];

    for (const node of allNodes) {
        nodes.push({
            data: {
                id: node,
                label: path.basename(node),
            },
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

export function buildCytoscapeElements(graph: Map<string, Set<string>>): {
    nodes: unknown[];
    edges: unknown[];
} {
    const allNodes = collectAllNodes(graph);
    const nodes = buildNodes(allNodes);
    const edges = buildEdges(graph);

    return {
        nodes,
        edges,
    };
}
