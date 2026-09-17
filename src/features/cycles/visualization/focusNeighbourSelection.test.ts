import { FocusEdgeRef, selectFocusNeighbours } from './focusNeighbourSelection';

// Real behavioral tests: selectFocusNeighbours is executed directly with
// plain data, not inferred from generated HTML text (see the module's own
// comment for why this is the actual shipped client-side algorithm, not a
// parallel reimplementation).

function fanOutEdges(coreId: string, neighbourIds: string[]): FocusEdgeRef[] {
    return neighbourIds.map((id) => ({ source: coreId, target: id }));
}

describe('selectFocusNeighbours', () => {
    it('A<->B cycle with 3 neighbours: all shown, none overflow (small-graph UX unaffected)', () => {
        const edges: FocusEdgeRef[] = [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'A' },
            ...fanOutEdges('A', ['n1', 'n2']),
            { source: 'n3', target: 'B' },
        ];

        const result = selectFocusNeighbours(['A', 'B'], edges, 30);

        expect(new Set(result.shown)).toEqual(new Set(['n1', 'n2', 'n3']));
        expect(result.overflow).toEqual([]);
    });

    it('A<->B cycle with 100 neighbours, limit 30: exactly 30 shown, 70 overflow', () => {
        const neighbourIds = Array.from({ length: 100 }, (_, i) => `n${i}`);
        const edges: FocusEdgeRef[] = [{ source: 'A', target: 'B' }, ...fanOutEdges('A', neighbourIds)];

        const result = selectFocusNeighbours(['A', 'B'], edges, 30);

        expect(result.shown).toHaveLength(30);
        expect(result.overflow).toHaveLength(70);
        expect(new Set([...result.shown, ...result.overflow])).toEqual(new Set(neighbourIds));
    });

    it('A<->B cycle with 600 neighbours (the hub-cycle regression case, e.g. logger/config): shown count stays bounded at the limit, never balloons to the full fan-out', () => {
        const neighbourIds = Array.from({ length: 600 }, (_, i) => `module${i}`);
        const edges: FocusEdgeRef[] = [
            { source: 'logger', target: 'config' },
            { source: 'config', target: 'logger' },
            ...neighbourIds.map((id) => ({ source: id, target: 'logger' })),
        ];

        const result = selectFocusNeighbours(['logger', 'config'], edges, 30);

        expect(result.shown).toHaveLength(30);
        expect(result.overflow).toHaveLength(570);
        // The core invariant this fix exists for: Focused Graph's shown set
        // (core + neighbours) must never approach the real fan-out size.
        expect(result.shown.length + 2).toBeLessThan(40);
    });

    it('cycle with fan-out (core members each pointing outward to distinct neighbours): every fanned-out neighbour is a candidate', () => {
        const edges: FocusEdgeRef[] = [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'A' },
            { source: 'A', target: 'out1' },
            { source: 'A', target: 'out2' },
            { source: 'B', target: 'out3' },
        ];

        const result = selectFocusNeighbours(['A', 'B'], edges, 30);

        expect(new Set(result.shown)).toEqual(new Set(['out1', 'out2', 'out3']));
    });

    it('cycle with fan-in (distinct neighbours each pointing into core members): every fanning-in neighbour is a candidate', () => {
        const edges: FocusEdgeRef[] = [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'A' },
            { source: 'in1', target: 'A' },
            { source: 'in2', target: 'A' },
            { source: 'in3', target: 'B' },
        ];

        const result = selectFocusNeighbours(['A', 'B'], edges, 30);

        expect(new Set(result.shown)).toEqual(new Set(['in1', 'in2', 'in3']));
    });

    it('a neighbour connected to multiple core members outranks one connected to only one, even with fewer total edges', () => {
        const edges: FocusEdgeRef[] = [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'C' },
            { source: 'C', target: 'A' },
            // 'multi' touches all three core members once each (3 edges,
            // 3 distinct core connections).
            { source: 'multi', target: 'A' },
            { source: 'multi', target: 'B' },
            { source: 'multi', target: 'C' },
            // 'single' touches only 'A', but with more raw edges (5) than
            // 'multi' has - raw edge count must not outrank distinct core
            // connectivity.
            { source: 'single', target: 'A' },
            { source: 'A', target: 'single' },
            { source: 'single', target: 'A' },
            { source: 'A', target: 'single' },
            { source: 'single', target: 'A' },
        ];

        const result = selectFocusNeighbours(['A', 'B', 'C'], edges, 1);

        expect(result.shown).toEqual(['multi']);
        expect(result.overflow).toEqual(['single']);
    });

    it('large SCC core (e.g. a 50-member representative cycle) still bounds its own neighbour set independently of core size', () => {
        const coreIds = Array.from({ length: 50 }, (_, i) => `core${i}`);
        const neighbourIds = Array.from({ length: 200 }, (_, i) => `n${i}`);
        const edges: FocusEdgeRef[] = [
            ...coreIds.map((id, i) => ({ source: id, target: coreIds[(i + 1) % coreIds.length] as string })),
            ...neighbourIds.map((id, i) => ({ source: coreIds[i % coreIds.length] as string, target: id })),
        ];

        const result = selectFocusNeighbours(coreIds, edges, 30);

        expect(result.shown).toHaveLength(30);
        expect(result.overflow).toHaveLength(170);
    });

    it('deterministic ordering: identical input always produces the identical shown/overflow split, independent of edge array order', () => {
        const neighbourIds = Array.from({ length: 40 }, (_, i) => `n${i}`);
        const edgesInOrder: FocusEdgeRef[] = [{ source: 'A', target: 'B' }, ...fanOutEdges('A', neighbourIds)];
        const edgesShuffled = [...edgesInOrder].reverse();

        const first = selectFocusNeighbours(['A', 'B'], edgesInOrder, 30);
        const second = selectFocusNeighbours(['A', 'B'], edgesInOrder, 30);
        const third = selectFocusNeighbours(['A', 'B'], edgesShuffled, 30);

        expect(second).toEqual(first);
        expect(third).toEqual(first);
    });

    it('two equally-connected neighbours (same core-connection count and edge count) break ties by a fixed, deterministic id order - never by array/collection order', () => {
        const edges: FocusEdgeRef[] = [
            { source: 'A', target: 'B' },
            { source: 'zzz', target: 'A' },
            { source: 'aaa', target: 'A' },
        ];

        const result = selectFocusNeighbours(['A', 'B'], edges, 1);

        expect(result.shown).toEqual(['aaa']);
        expect(result.overflow).toEqual(['zzz']);
    });

    it('graph without cycles (no core members / empty core set): returns no shown or overflow neighbours', () => {
        const edges: FocusEdgeRef[] = [
            { source: 'x', target: 'y' },
            { source: 'y', target: 'z' },
        ];

        const result = selectFocusNeighbours([], edges, 30);

        expect(result.shown).toEqual([]);
        expect(result.overflow).toEqual([]);
    });

    it('edges entirely between core members (internal) or entirely outside it are excluded from neighbour candidacy', () => {
        const edges: FocusEdgeRef[] = [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'A' },
            { source: 'far1', target: 'far2' },
        ];

        const result = selectFocusNeighbours(['A', 'B'], edges, 30);

        expect(result.shown).toEqual([]);
        expect(result.overflow).toEqual([]);
    });
});
