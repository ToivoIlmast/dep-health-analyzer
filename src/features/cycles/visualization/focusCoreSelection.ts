// Chooses which members of an SCC larger than the Focus core budget form the
// Focused Graph core. Framework-free and self-contained so its compiled
// source can be embedded verbatim into the report's client script via
// `selectFocusCore.toString()` (same pattern as focusNeighbourSelection.ts).
//
// Contract: returns exactly min(memberIds.length, limit) distinct members,
// starting with startId when it is a member. The size never depends on the
// SCC's shape or on how short a cycle through startId is - the core is a
// coverage budget, not a cycle.
import type { FocusEdgeRef } from './focusNeighbourSelection';

// Breadth-first over SCC-internal edges in both directions (an importer and
// an imported module are both one dependency away), with sorted adjacency so
// the result never depends on edge or collection order. If the traversal
// runs dry before the budget is spent - possible only when some members are
// excluded (e.g. by the Area filter) and cut the remaining ones off - it
// resumes from the smallest unvisited member.
export function selectFocusCore(memberIds: string[], edges: FocusEdgeRef[], startId: string, limit: number): string[] {
    const sortedMembers = Array.from(new Set(memberIds)).sort();
    const memberSet = new Set(sortedMembers);
    const adjacency = new Map<string, string[]>();

    for (const id of sortedMembers) {
        adjacency.set(id, []);
    }

    for (const edge of edges) {
        if (edge.source === edge.target || !memberSet.has(edge.source) || !memberSet.has(edge.target)) {
            continue;
        }
        adjacency.get(edge.source)!.push(edge.target);
        adjacency.get(edge.target)!.push(edge.source);
    }

    for (const targets of adjacency.values()) {
        targets.sort();
    }

    const budget = Math.min(sortedMembers.length, limit);
    const selected: string[] = [];
    const visited = new Set<string>();
    let nextSeedIndex = 0;
    let seed: string | undefined = memberSet.has(startId) ? startId : sortedMembers[0];

    while (selected.length < budget && seed !== undefined) {
        const queue = [seed];
        visited.add(seed);
        let head = 0;

        while (head < queue.length && selected.length < budget) {
            const current = queue[head]!;
            head += 1;
            selected.push(current);

            for (const next of adjacency.get(current)!) {
                if (!visited.has(next)) {
                    visited.add(next);
                    queue.push(next);
                }
            }
        }

        seed = undefined;
        while (nextSeedIndex < sortedMembers.length && seed === undefined) {
            const candidate = sortedMembers[nextSeedIndex]!;
            nextSeedIndex += 1;
            if (!visited.has(candidate)) {
                seed = candidate;
            }
        }
    }

    return selected;
}
