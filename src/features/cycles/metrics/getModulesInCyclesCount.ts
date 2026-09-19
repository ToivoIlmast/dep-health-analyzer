import { DependencyGraph } from '@core/graph/types';
import { isRealCycleScc } from './realCycles';

/**
 * F14: "Modules in cycles" - the one cycle-related headline number that is
 * monotone. Unlike "Cycles detected" (SCC count), fusing two cycles into
 * one bigger SCC can never make this go down, because it is a SUM of every
 * real cyclic SCC's own member count, not a count of how many SCCs there
 * are. findSCCs() partitions every node into exactly one component, so
 * summing sizes across DISJOINT real-cycle components can never double
 * count a module that happens to sit on more than one simple cycle within
 * the same SCC (that's exactly what isRealCycleScc/filterRealCycleSccs -
 * realCycles.ts, the single shared "is this a real cycle" definition
 * getLargestSccSize.ts already uses the same way - guarantees: the SCCs it
 * lets through are still a partition, just with the non-cyclic trivial
 * ones dropped).
 */
export function getModulesInCyclesCount(sccs: string[][], graph: DependencyGraph): number {
    let total = 0;

    for (const scc of sccs) {
        if (isRealCycleScc(scc, graph)) {
            total += scc.length;
        }
    }

    return total;
}
