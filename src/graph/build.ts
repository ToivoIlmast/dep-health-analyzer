import type { DependencyGraph } from './types';

export function createGraph(): DependencyGraph {
    return {
        nodes: new Set(),
        edges: new Map(),
    };
}

export function addEdge(graph: DependencyGraph, from: string, to: string): void {
    graph.nodes.add(from);
    graph.nodes.add(to);

    if (!graph.edges.has(from)) {
        graph.edges.set(from, new Set());
    }

    graph.edges.get(from)!.add(to);
}
