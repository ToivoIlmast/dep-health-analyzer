import { Graph } from './types';

export type DFSContext = {
    graph: Graph;
    visited: Set<string>;
    result: string[];
    order?: string[];
};

export function depthFirstSearch(node: string, context: DFSContext): void {
    const { graph, visited, result, order } = context;

    if (visited.has(node)) {
        return;
    }

    visited.add(node);

    const neighbors = graph.get(node) ?? new Set<string>();

    for (const neighbor of neighbors) {
        depthFirstSearch(neighbor, context);
    }

    result.unshift(node);

    if (order) {
        order.push(node);
    }
}
