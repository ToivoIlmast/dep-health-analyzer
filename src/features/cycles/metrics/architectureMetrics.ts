import { DependencyGraph } from '@core/graph/types';
import { ModuleMetrics } from './types';
import { reverseGraph } from './reverseGraph';

function instability(ce: number, ca: number): number {
    // A fully isolated module (no incoming or outgoing edges) has no
    // coupling in either direction, so there's no pressure to change it -
    // 0 (maximally stable) is the only sensible reading. Left unguarded,
    // ce/(ca+ce) divides 0 by 0 and produces NaN, which then rendered as
    // the literal text "NaN" in reports.
    if (ca + ce === 0) {
        return 0;
    }

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
