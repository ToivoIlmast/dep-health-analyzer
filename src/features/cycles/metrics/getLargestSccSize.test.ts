import type { DependencyGraph } from '@core/graph/types';
import { getLargestSccSize } from './getLargestSccSize';

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

describe('getLargestSccSize', () => {
    it('returns 0 when there are no components at all', () => {
        expect(getLargestSccSize([], makeGraph({}))).toBe(0);
    });

    it('returns 0 for a graph with only trivial (non-cyclic) size-1 components', () => {
        const graph = makeGraph({ 'a.ts': ['b.ts'] });
        const sccs = [['a.ts'], ['b.ts']];

        expect(getLargestSccSize(sccs, graph)).toBe(0);
    });

    it('counts a real multi-node cycle', () => {
        const graph = makeGraph({ 'a.ts': ['b.ts'], 'b.ts': ['a.ts'] });
        const sccs = [['a.ts', 'b.ts']];

        expect(getLargestSccSize(sccs, graph)).toBe(2);
    });

    it('picks the largest among multiple real cycles', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts'],
            'b.ts': ['a.ts'],
            'x.ts': ['y.ts'],
            'y.ts': ['z.ts'],
            'z.ts': ['x.ts'],
        });
        const sccs = [
            ['a.ts', 'b.ts'],
            ['x.ts', 'y.ts', 'z.ts'],
        ];

        expect(getLargestSccSize(sccs, graph)).toBe(3);
    });

    it('correctly finds the true SCC size for overlapping cycles sharing a node', () => {
        // A->B->C->A and A->D->A: all 4 nodes are genuinely one SCC, since
        // every node can reach every other node. This is the exact case a
        // naive cycle enumerator (detectCycles) undercounts as 3, not 4.
        const graph = makeGraph({
            'a.ts': ['b.ts', 'd.ts'],
            'b.ts': ['c.ts'],
            'c.ts': ['a.ts'],
            'd.ts': ['a.ts'],
        });
        const sccs = [['a.ts', 'b.ts', 'c.ts', 'd.ts']];

        expect(getLargestSccSize(sccs, graph)).toBe(4);
    });

    it('counts a self-loop as a real size-1 cycle', () => {
        const graph = makeGraph({ 'selfloop.ts': ['selfloop.ts'] });
        const sccs = [['selfloop.ts']];

        expect(getLargestSccSize(sccs, graph)).toBe(1);
    });

    it('a self-loop cycle still loses to a larger real cycle elsewhere', () => {
        const graph = makeGraph({
            'selfloop.ts': ['selfloop.ts'],
            'a.ts': ['b.ts'],
            'b.ts': ['c.ts'],
            'c.ts': ['a.ts'],
        });
        const sccs = [['selfloop.ts'], ['a.ts', 'b.ts', 'c.ts']];

        expect(getLargestSccSize(sccs, graph)).toBe(3);
    });
});
