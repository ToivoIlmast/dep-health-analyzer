import { Graph } from './types';

export function reverseGraph(graph: Graph): Graph {
    const reversed = new Map<string, Set<string>>();

    for (const node of graph.keys()) {
        reversed.set(node, new Set());
    }

    for (const [from, neighbors] of graph.entries()) {
        for (const to of neighbors) {
            reversed.get(to)?.add(from);
        }
    }

    return reversed;
}
