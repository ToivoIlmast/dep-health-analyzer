import { DependencyGraph } from '@core/graph/types';
import { ModuleMetrics } from './types';
import { reverseGraph } from './reverseGraph';

function instability(ce: number, ca: number): number {
    return Number((ce / (ca + ce)).toFixed(2));
}

export function calculateArchitectureMetrics(graph: DependencyGraph): Map<string, ModuleMetrics> {
    const metrics = new Map<string, ModuleMetrics>();
    const incomingEdges = reverseGraph(graph.edges);

    for (const file of graph.nodes) {
        const outgoingEdges = graph.edges.get(file)?.size ?? 0;
        const incomingEdgesCount = incomingEdges.get(file)?.size ?? 0;

        metrics.set(file, {
            ca: incomingEdgesCount,
            ce: outgoingEdges,
            instability: instability(outgoingEdges, incomingEdgesCount),
        });
    }

    return metrics;
}
