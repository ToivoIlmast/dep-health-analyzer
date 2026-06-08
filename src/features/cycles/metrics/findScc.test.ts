import { DependencyGraph } from '@core/graph/types';
import { findSCCs } from './findScc';

describe('findSCCs', () => {
    it('returns separate SCCs for an acyclic graph', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set()],
            ]),
        };

        const sccs = [['A'], ['B'], ['C']];
        const result = findSCCs(graph);
        expect(result).toEqual(sccs);
    });

    it('detects a single strongly connected component', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set(['A'])],
            ]),
        };

        const expected = [['A', 'B', 'C']].map((scc) => scc.sort()).sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('detects multiple strongly connected components', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['A'])],

                ['C', new Set(['D'])],
                ['D', new Set(['C'])],
            ]),
        };

        const expected = [
            ['A', 'B'],
            ['C', 'D'],
        ]
            .map((scc) => scc.sort())
            .sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('detects SCCs with isolated nodes', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['A'])],

                ['C', new Set()],
                ['D', new Set()],
            ]),
        };

        const expected = [['A', 'B'], ['C'], ['D']].map((scc) => scc.sort()).sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('detects nested SCC regions correctly', () => {
        // `A` -> `B` -> `C` -> `A`
        //                |
        //                v
        //               `D`
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set(['A', 'D'])],
                ['D', new Set()],
            ]),
        };

        const expected = [['A', 'B', 'C'], ['D']].map((scc) => scc.sort()).sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('returns an empty array for an empty graph', () => {
        const graph: DependencyGraph = {
            nodes: new Set(),
            edges: new Map<string, Set<string>>(),
        };

        const expected: string[][] = [];

        const result = findSCCs(graph);
        expect(result).toEqual(expected);
    });

    it('returns single-node SCCs for disconnected nodes', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set()],
                ['B', new Set()],
                ['C', new Set()],
            ]),
        };

        const expected = [['A'], ['B'], ['C']].map((scc) => scc.sort()).sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('does not merge one-way reachable nodes into the same SCC', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set()],
            ]),
        };

        const expected = [['A'], ['B'], ['C']].map((scc) => scc.sort()).sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('detects SCCs in graphs with multiple cycles', () => {
        // A -> B -> A
        // C -> D -> E -> C
        // F isolated
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D', 'E', 'F']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['A'])],

                ['C', new Set(['D'])],
                ['D', new Set(['E'])],
                ['E', new Set(['C'])],

                ['F', new Set()],
            ]),
        };

        const expected = [['A', 'B'], ['C', 'D', 'E'], ['F']].map((scc) => scc.sort()).sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('handles complex graphs with cycles and linear chains', () => {
        // `A` -> `B` -> `C` -> `A`
        //                |
        //                v
        //               `D` -> `E` -> `F`
        //
        // `G` isolated
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set(['A', 'D'])],

                ['D', new Set(['E'])],
                ['E', new Set(['F'])],
                ['F', new Set()],

                ['G', new Set()],
            ]),
        };

        const expected = [['A', 'B', 'C'], ['D'], ['E'], ['F'], ['G']]
            .map((scc) => scc.sort())
            .sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('correctly returns SCCs for mixed graph structures', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D', 'E']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['A'])],

                ['C', new Set(['D'])],
                ['D', new Set()],

                ['E', new Set()],
            ]),
        };

        const expected = [['A', 'B'], ['C'], ['D'], ['E']].map((scc) => scc.sort()).sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });

    it('does not duplicate nodes across SCCs', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['A'])],

                ['C', new Set(['D'])],
                ['D', new Set()],
            ]),
        };

        const expected = [['A', 'B'], ['C'], ['D']].map((scc) => scc.sort()).sort();

        const result = findSCCs(graph);

        const normalized = result.map((scc) => scc.sort()).sort();

        const flatNodes = result.flat();
        const uniqueNodes = new Set(flatNodes);

        expect(normalized).toEqual(expected);
        expect(flatNodes.length).toBe(uniqueNodes.size);
    });

    it('correctly detects SCCs connected by one-way edges', () => {
        // `A` -> `B` -> `A`
        //         |
        //         v
        // `C` -> `D` -> `C`
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['A', 'C'])],

                ['C', new Set(['D'])],
                ['D', new Set(['C'])],
            ]),
        };

        const expected = [
            ['A', 'B'],
            ['C', 'D'],
        ]
            .map((scc) => scc.sort())
            .sort();

        const result = findSCCs(graph);
        const normalized = result.map((scc) => scc.sort()).sort();
        expect(normalized).toEqual(expected);
    });
});
