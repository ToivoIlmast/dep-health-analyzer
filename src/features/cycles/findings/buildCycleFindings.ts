import { DependencyGraph } from '@core/graph/types';

export interface SccFinding {
    // The same index buildCytoscapeElements.ts already assigns as a real
    // node's data.sccId - both are computed by applying the identical
    // `scc.length > 1` filter to the same findSCCs() output, in the same
    // order, so this id stays a valid sccId a future UI could hand
    // straight to the graph (e.g. to focus/highlight this exact SCC)
    // without any remapping step.
    id: number;
    size: number;
    // Sorted alphabetically - not the order Kosaraju's own DFS happened to
    // visit them in, which is an internal algorithm detail, not something
    // a reader should have to make sense of. Sorting here also means this
    // module's own output is deterministic independent of whatever order
    // upstream file discovery happened to produce the graph in.
    memberIds: string[];
    // One concrete, deterministic directed cycle through this SCC ([start,
    // ..., start], closed - start repeated at both ends), not every
    // possible cycle (the number of simple cycles in a strongly connected
    // graph can be super-exponential in its size) and not the literal
    // output of detectCycles() (that function's shared-visited-set DFS can
    // silently skip a node that an earlier, unrelated cycle already
    // consumed - see analyzeCycles.ts's own comment on this exact
    // undercount). Computed fresh here from this SCC's own real member set
    // and real graph edges, scoped to just this SCC - never a second SCC
    // detection.
    exampleCycle: string[];
}

export interface CycleFindings {
    moduleCount: number;
    dependencyCount: number;
    sccs: SccFinding[];
}

/**
 * A non-trivial SCC (size >= 2) always has at least one outgoing edge from
 * every member to some OTHER member - that's what strong connectivity with
 * 2+ members means. This excludes a self-loop (a member importing itself)
 * from being picked as that "outgoing edge": a self-loop that happens to
 * sort first would otherwise let the very first BFS step immediately
 * arrive back at the start, producing a degenerate `[start, start]`
 * "cycle" that ignores the SCC's real multi-member structure entirely -
 * technically closed, but not representative of why this SCC is a
 * finding worth 2+ members in the first place.
 */
function pickFirstStep(start: string, adjacency: Map<string, string[]>): string {
    const targets = adjacency.get(start) ?? [];
    const realTargets = targets.filter((target) => target !== start);

    // Falls back to the self-loop only if literally nothing else exists -
    // shouldn't happen for a real (size >= 2) SCC, kept as a defensive
    // floor rather than throwing.
    return realTargets[0] ?? targets[0]!;
}

/**
 * One deterministic directed cycle through the given SCC's own members,
 * always starting (and closing back to) the alphabetically smallest
 * member id - an arbitrary but fixed choice, not "the best"/"shortest"/
 * "most important" cycle, matching the same non-goal already established
 * for this exact kind of representative-cycle search in this codebase's
 * client-side findCycleThroughNode().
 *
 * Algorithm: step to the start's own first (sorted, so deterministic)
 * real outgoing neighbor within the SCC, then run a plain breadth-first
 * search - visiting each member at most once - back to the start. BFS is
 * strictly O(members + internal edges): no combinatorial enumeration of
 * every possible cycle, and no risk of the exponential blowup a naive
 * "DFS that only excludes nodes already on the current path" can hit on a
 * densely-interconnected SCC (many alternate routes would otherwise all
 * get explored before backtracking to the one that actually closes the
 * loop).
 */
function findRepresentativeCycle(memberIds: string[], graph: DependencyGraph): string[] {
    const memberSet = new Set(memberIds);
    const adjacency = new Map<string, string[]>();

    for (const member of memberIds) {
        const targets = [...(graph.edges.get(member) ?? [])]
            .filter((target) => memberSet.has(target))
            .sort();
        adjacency.set(member, targets);
    }

    const sortedMembers = [...memberIds].sort();
    const start = sortedMembers[0]!;
    const firstStep = pickFirstStep(start, adjacency);

    const cameFrom = new Map<string, string | null>([[firstStep, null]]);
    const queue = [firstStep];
    let head = 0;

    while (head < queue.length) {
        const current = queue[head]!;
        head += 1;

        if (current === start) {
            break;
        }

        for (const next of adjacency.get(current) ?? []) {
            if (!cameFrom.has(next)) {
                cameFrom.set(next, current);
                queue.push(next);
            }
        }
    }

    const backToFirstStep: string[] = [];
    for (let node: string | null = start; node !== null; node = cameFrom.get(node) ?? null) {
        backToFirstStep.push(node);
    }
    backToFirstStep.reverse();

    return [start, ...backToFirstStep];
}

function countDependencies(graph: DependencyGraph): number {
    let count = 0;

    for (const targets of graph.edges.values()) {
        count += targets.size;
    }

    return count;
}

type BuildCycleFindings = {
    graph: DependencyGraph;
    // The raw, unfiltered findSCCs() output - the SAME array (and, by
    // extension, the same per-SCC index/order) buildCytoscapeElements.ts
    // filters and indexes for each node's data.sccId, so both call sites
    // must be given the identical array from a single findSCCs() call,
    // never two independent invocations.
    sccs: string[][];
};

/**
 * The findings source of truth is Kosaraju's algorithm (findSCCs), not
 * detectCycles() - findSCCs partitions every node into exactly one
 * component, so two cycles that share a node (e.g. A->B->C->A plus
 * A->D->A) are correctly counted as the one SCC they really are, not two
 * separate findings the way detectCycles' naive, undercounting DFS would
 * report them.
 *
 * "Non-trivial" here means the same `scc.length > 1` a real node already
 * needs to get a data-sccId in the existing graph (see
 * buildCytoscapeElements.ts's `realSccs` filter) - a lone self-loop file
 * (a size-1 component that imports itself) is intentionally excluded here
 * too, for consistency with what the graph itself already treats as a
 * highlighted SCC. This differs from getLargestSccSize.ts's own
 * self-loop-aware "is this a real cycle" check (used only for the
 * console's "Largest SCC" scalar) - a known, pre-existing inconsistency
 * between those two call sites, not something this function should
 * silently paper over by picking a third definition.
 */
export function buildCycleFindings(args: BuildCycleFindings): CycleFindings {
    const { graph, sccs } = args;

    const nonTrivialSccs = sccs.filter((scc) => scc.length > 1);

    const findings: SccFinding[] = nonTrivialSccs.map((scc, index) => {
        const memberIds = [...scc].sort();

        return {
            id: index,
            size: scc.length,
            memberIds,
            exampleCycle: findRepresentativeCycle(memberIds, graph),
        };
    });

    return {
        moduleCount: graph.nodes.size,
        dependencyCount: countDependencies(graph),
        sccs: findings,
    };
}
