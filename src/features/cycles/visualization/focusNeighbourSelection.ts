// P0-1 fix (pre-v0.10.2 audit): Focused Graph's 1-hop neighbourhood around a
// cycle/SCC's core members used to be shown in full, with no limit at all.
// A widely-imported module (e.g. a shared logger/config pair that hundreds
// of other modules import) can have hundreds of direct neighbours, which
// silently turned a "focus on this one cycle" view into nearly the whole
// project graph - defeating the entire point of Focused Graph.
//
// This module is deliberately framework-free: plain string ids and
// {source, target} edge references, no cytoscape types, no DOM. Two
// reasons:
//
// 1. It can be unit-tested directly with plain data (see this file's own
//    .test.ts) - real execution of the real ranking/selection algorithm,
//    not an assertion that some substring appears in generated HTML text
//    (which is how the rest of this report's client-side logic is
//    necessarily tested, since it's cytoscape+DOM glue with no bundler).
//
// 2. Its exact compiled source is embedded into the generated report's
//    client-side <script> via `selectFocusNeighbours.toString()` in
//    template.ts, so the algorithm verified here is byte-for-byte the same
//    code that runs in the browser - there is no separate client
//    reimplementation that could drift out of sync with what these tests
//    actually check.
export type FocusEdgeRef = {
    source: string;
    target: string;
};

export type FocusNeighbourSelection = {
    shown: string[];
    overflow: string[];
};

// Ranking strategy (in priority order), per the audit's own preferred
// principle: neighbours connected to MULTIPLE core members first (they say
// the most about how this cycle/SCC reaches into the rest of the project),
// then neighbours with the highest raw connectivity (edge count) to the
// core, then a fixed deterministic tie-break (plain id comparison) - never
// cytoscape's own collection iteration order, which callers must not rely
// on for anything user-visible.
export function selectFocusNeighbours(
    coreIds: string[],
    edges: FocusEdgeRef[],
    limit: number,
): FocusNeighbourSelection {
    const coreIdSet = new Set(coreIds);
    const stats = new Map<string, { coreConnections: Set<string>; edgeCount: number }>();

    for (const edge of edges) {
        const sourceIsCore = coreIdSet.has(edge.source);
        const targetIsCore = coreIdSet.has(edge.target);

        // Only a real core<->neighbour boundary edge is relevant here -
        // both-core (internal to the cycle/SCC) and both-outside (unrelated
        // to this focus entirely) edges are skipped.
        if (sourceIsCore === targetIsCore) {
            continue;
        }

        const neighbourId = sourceIsCore ? edge.target : edge.source;
        const coreMemberId = sourceIsCore ? edge.source : edge.target;

        let entry = stats.get(neighbourId);
        if (!entry) {
            entry = { coreConnections: new Set<string>(), edgeCount: 0 };
            stats.set(neighbourId, entry);
        }
        entry.coreConnections.add(coreMemberId);
        entry.edgeCount += 1;
    }

    const ranked = Array.from(stats.entries())
        .map(([id, entry]) => ({
            id,
            coreConnectionCount: entry.coreConnections.size,
            edgeCount: entry.edgeCount,
        }))
        .sort((a, b) => {
            if (b.coreConnectionCount !== a.coreConnectionCount) {
                return b.coreConnectionCount - a.coreConnectionCount;
            }
            if (b.edgeCount !== a.edgeCount) {
                return b.edgeCount - a.edgeCount;
            }
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        });

    return {
        shown: ranked.slice(0, limit).map((entry) => entry.id),
        overflow: ranked.slice(limit).map((entry) => entry.id),
    };
}
