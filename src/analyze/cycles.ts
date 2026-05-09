import type { DependencyGraph } from '../graph/types';

export function detectCycles(graph: DependencyGraph): string[][] {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const cycles: string[][] = [];

    function dfs(node: string, path: string[]) {
        if (stack.has(node)) {
            const cycleStart = path.indexOf(node);
            const cycle = path.slice(cycleStart);

            cycles.push([...cycle, node]);
            return;
        }

        if (visited.has(node)) {
            return;
        }

        visited.add(node);
        stack.add(node);

        const neighbors = graph.edges.get(node);

        if (neighbors) {
            for (const neighbor of neighbors) {
                dfs(neighbor, [...path, node]);
            }
        }

        stack.delete(node);
    }

    for (const node of graph.nodes) {
        dfs(node, []);
    }

    return cycles;
}
