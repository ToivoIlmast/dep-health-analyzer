import { DependencyGraph } from '@core/graph/types';
import { isRealCycleScc } from './realCycles';

/**
 * Kosaraju's algorithm (findSCCs) partitions every node into a component,
 * including "trivial" size-1 components for nodes that aren't part of any
 * real cycle - counting those would make "Largest SCC" report 1 even for a
 * project with zero circular dependencies. isRealCycleScc (realCycles.ts)
 * is the single shared definition of "real cycle" every consumer of
 * findSCCs' output uses - see its own doc comment for why this must never
 * be re-derived independently per call site.
 */
export function getLargestSccSize(sccs: string[][], graph: DependencyGraph): number {
    let largest = 0;

    for (const scc of sccs) {
        if (isRealCycleScc(scc, graph) && scc.length > largest) {
            largest = scc.length;
        }
    }

    return largest;
}
