import type { DependencyGraph } from '@core/graph/types';
import { getModulesInCyclesCount } from './getModulesInCyclesCount';

function makeGraph(edges: Record<string, string[]>): DependencyGraph {
    const nodes = new Set<string>();
    const edgeMap = new Map<string, Set<string>>();

    for (const [from, tos] of Object.entries(edges)) {
        nodes.add(from);
        edgeMap.set(from, new Set(tos));
        for (const to of tos) {
            nodes.add(to);
        }
    }

    return { nodes, edges: edgeMap };
}

describe('getModulesInCyclesCount', () => {
    it('returns 0 for an empty graph with no components at all', () => {
        expect(getModulesInCyclesCount([], makeGraph({}))).toBe(0);
    });

    // Case E: acyclic graph - findSCCs still returns a trivial size-1
    // component per node; none of them is a real cycle.
    it('returns 0 for an acyclic graph (only trivial, non-cyclic size-1 components)', () => {
        const graph = makeGraph({ 'a.ts': ['b.ts'], 'b.ts': ['c.ts'] });
        const sccs = [['a.ts'], ['b.ts'], ['c.ts']];

        expect(getModulesInCyclesCount(sccs, graph)).toBe(0);
    });

    // Case A: one simple 3-module cycle.
    it('counts every member of a single real cycle', () => {
        const graph = makeGraph({ 'a.ts': ['b.ts'], 'b.ts': ['c.ts'], 'c.ts': ['a.ts'] });
        const sccs = [['a.ts', 'b.ts', 'c.ts']];

        expect(getModulesInCyclesCount(sccs, graph)).toBe(3);
    });

    // Case B: two independent SCCs - the count is a SUM across all of them,
    // not the size of the largest one (that distinction is exactly what
    // getLargestSccSize is for; this metric answers a different question).
    it('sums members across independent SCCs, unlike a "largest SCC" metric', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts'],
            'b.ts': ['a.ts'],
            'c.ts': ['d.ts'],
            'd.ts': ['c.ts'],
        });
        const sccs = [
            ['a.ts', 'b.ts'],
            ['c.ts', 'd.ts'],
        ];

        expect(getModulesInCyclesCount(sccs, graph)).toBe(4);
    });

    // Case C: two simple cycles (a->b->a, a->c->a) that share node "a" are
    // really ONE 3-member SCC (findSCCs already merges them before this
    // function ever sees them) - the count must be 3, the real member
    // count, never 4 (the naive sum of each simple cycle's own length,
    // 2 + 2, double-counting the shared member "a").
    it('counts the true SCC member count for one SCC formed by overlapping simple cycles - never the sum of the individual cycles\' lengths', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts', 'c.ts'],
            'b.ts': ['a.ts'],
            'c.ts': ['a.ts'],
        });
        const sccs = [['a.ts', 'b.ts', 'c.ts']];

        expect(getModulesInCyclesCount(sccs, graph)).toBe(3);
    });

    // Case F: a 4-member SCC formed by two overlapping cycles sharing a
    // node (A->B->C->A and A->D->A) - the same shape getLargestSccSize.test.ts
    // uses for its own "true SCC size" regression. Every member is counted
    // exactly once.
    it('counts a shared module between overlapping cycles exactly once', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts', 'd.ts'],
            'b.ts': ['c.ts'],
            'c.ts': ['a.ts'],
            'd.ts': ['a.ts'],
        });
        const sccs = [['a.ts', 'b.ts', 'c.ts', 'd.ts']];

        expect(getModulesInCyclesCount(sccs, graph)).toBe(4);
    });

    // Case D: a self-loop is a genuine size-1 real cycle (realCycles.ts's
    // shared definition), so it counts as 1 module in cycles - not 0.
    it('counts a self-loop as 1 module in cycles', () => {
        const graph = makeGraph({ 'selfloop.ts': ['selfloop.ts'] });
        const sccs = [['selfloop.ts']];

        expect(getModulesInCyclesCount(sccs, graph)).toBe(1);
    });

    it('excludes a trivial size-1 component that has no self-loop, even mixed in with real cycles', () => {
        const graph = makeGraph({
            'lonely.ts': ['a.ts'],
            'a.ts': ['b.ts'],
            'b.ts': ['a.ts'],
            'selfloop.ts': ['selfloop.ts'],
        });
        const sccs = [['lonely.ts'], ['a.ts', 'b.ts'], ['selfloop.ts']];

        // lonely.ts is size-1 with no self-loop - excluded. a.ts/b.ts is a
        // real 2-cycle - counted. selfloop.ts is a real 1-cycle - counted.
        expect(getModulesInCyclesCount(sccs, graph)).toBe(3);
    });

    // Case G: the result must not depend on the order components (or their
    // own members) happen to appear in - it's a sum over a partition, so
    // reordering either level must never change the total.
    it('is independent of component and member order (deterministic regardless of input order)', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts'],
            'b.ts': ['c.ts'],
            'c.ts': ['a.ts'],
            'x.ts': ['y.ts'],
            'y.ts': ['x.ts'],
        });
        const inOrder = [
            ['a.ts', 'b.ts', 'c.ts'],
            ['x.ts', 'y.ts'],
        ];
        const reordered = [
            ['y.ts', 'x.ts'],
            ['c.ts', 'a.ts', 'b.ts'],
        ];

        expect(getModulesInCyclesCount(inOrder, graph)).toBe(getModulesInCyclesCount(reordered, graph));
        expect(getModulesInCyclesCount(reordered, graph)).toBe(5);
    });
});
