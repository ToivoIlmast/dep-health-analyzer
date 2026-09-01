import { Graph } from './types';

function ensureNode(reversed: Graph, node: string): Set<string> {
    let neighbors = reversed.get(node);

    if (!neighbors) {
        neighbors = new Set();
        reversed.set(node, neighbors);
    }

    return neighbors;
}

export function reverseGraph(graph: Graph): Graph {
    const reversed = new Map<string, Set<string>>();

    for (const [from, neighbors] of graph.entries()) {
        ensureNode(reversed, from);

        for (const to of neighbors) {
            ensureNode(reversed, to).add(from);
        }
    }

    return reversed;
}
