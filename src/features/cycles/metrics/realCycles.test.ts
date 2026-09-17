import type { DependencyGraph } from '@core/graph/types';
import { filterRealCycleSccs, hasSelfLoop, isRealCycleScc } from './realCycles';

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

describe('hasSelfLoop', () => {
    it('is true for a node that imports itself', () => {
        const graph = makeGraph({ 'a.ts': ['a.ts'] });
        expect(hasSelfLoop('a.ts', graph)).toBe(true);
    });

    it('is false for a node with no self edge', () => {
        const graph = makeGraph({ 'a.ts': ['b.ts'] });
        expect(hasSelfLoop('a.ts', graph)).toBe(false);
    });

    it('is false for a node with no outgoing edges at all', () => {
        const graph = makeGraph({ 'a.ts': [] });
        expect(hasSelfLoop('a.ts', graph)).toBe(false);
    });
});

describe('isRealCycleScc', () => {
    it('is false for an empty component', () => {
        const graph = makeGraph({});
        expect(isRealCycleScc([], graph)).toBe(false);
    });

    it('is false for a trivial size-1 component with no self-loop', () => {
        const graph = makeGraph({ 'a.ts': ['b.ts'], 'b.ts': [] });
        expect(isRealCycleScc(['b.ts'], graph)).toBe(false);
    });

    it('is true for a size-1 component that is a genuine self-loop', () => {
        const graph = makeGraph({ 'a.ts': ['a.ts'] });
        expect(isRealCycleScc(['a.ts'], graph)).toBe(true);
    });

    it('is true for any 2+-member component regardless of self-loops', () => {
        const graph = makeGraph({ 'a.ts': ['b.ts'], 'b.ts': ['a.ts'] });
        expect(isRealCycleScc(['a.ts', 'b.ts'], graph)).toBe(true);
    });
});

describe('filterRealCycleSccs', () => {
    it('drops trivial components but keeps their relative order for real ones', () => {
        const graph = makeGraph({
            'iso.ts': [],
            'a.ts': ['b.ts'],
            'b.ts': ['a.ts'],
            'self.ts': ['self.ts'],
            'x.ts': ['y.ts'],
            'y.ts': ['z.ts'],
            'z.ts': ['x.ts'],
        });
        const sccs = [['iso.ts'], ['a.ts', 'b.ts'], ['self.ts'], ['x.ts', 'y.ts', 'z.ts']];

        expect(filterRealCycleSccs(sccs, graph)).toEqual([
            ['a.ts', 'b.ts'],
            ['self.ts'],
            ['x.ts', 'y.ts', 'z.ts'],
        ]);
    });

    it('returns an empty array for a graph with no real cycles at all', () => {
        const graph = makeGraph({ 'a.ts': ['b.ts'], 'b.ts': ['c.ts'], 'c.ts': [] });
        const sccs = [['a.ts'], ['b.ts'], ['c.ts']];

        expect(filterRealCycleSccs(sccs, graph)).toEqual([]);
    });
});
