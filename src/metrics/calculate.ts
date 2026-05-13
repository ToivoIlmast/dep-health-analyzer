import { NodeId } from '../graph/types';

export interface ModuleMetrics {
    ca: number;
    ce: number;
    instability: number;
}

function ce(dependencies: Set<string>): number {
    return dependencies.size;
}

function ca(edges: Map<string, Set<string>>, file: string): number {
    return [...edges.values()].filter((set) => set.has(file)).length;
}

function instability(ce: number, ca: number): number {
    return Number((ce / (ca + ce)).toFixed(2));
}

export function calculate(edges: Map<NodeId, Set<NodeId>>): Map<string, ModuleMetrics> {
    const metrics = new Map<string, ModuleMetrics>();

    for (const [file, dependencies] of edges) {
        const outgoingEdges = ce(dependencies);
        const incomingEdges = ca(edges, file);

        metrics.set(file, {
            ca: incomingEdges,
            ce: outgoingEdges,
            instability: instability(outgoingEdges, incomingEdges),
        });
    }

    return metrics;
}
