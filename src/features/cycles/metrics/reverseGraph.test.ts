import { reverseGraph } from './reverseGraph';
import { Graph } from './types';

describe('reverseGraph', () => {
    it('reverses a complex graph', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B', 'C'])],
            ['B', new Set(['D'])],
            ['C', new Set()],
            ['D', new Set(['A'])],
            ['E', new Set()],
        ]);

        const resultReverseGraph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['D'])],
            ['B', new Set(['A'])],
            ['C', new Set(['A'])],
            ['D', new Set(['B'])],
            ['E', new Set()],
        ]);

        const result = reverseGraph(graph);
        expect(result).toEqual(resultReverseGraph);
    });

    it('reverses a linear dependency chain', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set(['D'])],
            ['D', new Set()],
        ]);

        const resultReverseGraph: Graph = new Map<string, Set<string>>([
            ['A', new Set()],
            ['B', new Set(['A'])],
            ['C', new Set(['B'])],
            ['D', new Set(['C'])],
        ]);

        const result = reverseGraph(graph);
        expect(result).toEqual(resultReverseGraph);
    });

    it('preserves isolated nodes', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set()],
            ['C', new Set()],
            ['D', new Set()],
        ]);

        const resultReverseGraph: Graph = new Map<string, Set<string>>([
            ['A', new Set()],
            ['B', new Set(['A'])],
            ['C', new Set()],
            ['D', new Set()],
        ]);

        const result = reverseGraph(graph);
        expect(result).toEqual(resultReverseGraph);
    });

    it('reverses multiple incoming dependencies', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['C'])],
            ['B', new Set(['C'])],
            ['C', new Set()],
            ['D', new Set(['C'])],
        ]);

        const resultReverseGraph: Graph = new Map<string, Set<string>>([
            ['A', new Set()],
            ['B', new Set()],
            ['C', new Set(['A', 'B', 'D'])],
            ['D', new Set()],
        ]);

        const result = reverseGraph(graph);
        expect(result).toEqual(resultReverseGraph);
    });

    it('correctly reverses cyclic graphs', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set(['A'])],
        ]);

        const resultReverseGraph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['C'])],
            ['B', new Set(['A'])],
            ['C', new Set(['B'])],
        ]);

        const result = reverseGraph(graph);
        expect(result).toEqual(resultReverseGraph);
    });

    it('does not mutate the original graph', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set()],
        ]);

        const originalGraph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set()],
        ]);

        reverseGraph(graph);
        expect(graph).toEqual(originalGraph);
    });

    it('returns an empty graph for empty input', () => {
        const graph: Graph = new Map<string, Set<string>>();
        const result = reverseGraph(graph);
        expect(result).toEqual(new Map());
    });

    it('preserves all graph nodes after reversal', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set()],
            ['C', new Set()],
            ['D', new Set(['A'])],
            ['E', new Set()],
        ]);

        const result = reverseGraph(graph);

        expect(result.has('A')).toBeTruthy();
        expect(result.has('B')).toBeTruthy();
        expect(result.has('C')).toBeTruthy();
        expect(result.has('D')).toBeTruthy();
        expect(result.has('E')).toBeTruthy();

        expect(result.size).toBe(5);
    });

    it('creates independent Sets for reversed nodes', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set()],
        ]);

        const originalGraph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set()],
        ]);

        const result = reverseGraph(graph);
        result.get('B')?.add('F');
        expect(graph).toEqual(originalGraph);
    });

    it('handles nodes with multiple outgoing dependencies', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B', 'C', 'D'])],
            ['B', new Set()],
            ['C', new Set()],
            ['D', new Set()],
        ]);

        const resultReverseGraph: Graph = new Map<string, Set<string>>([
            ['A', new Set()],
            ['B', new Set(['A'])],
            ['C', new Set(['A'])],
            ['D', new Set(['A'])],
        ]);

        const result = reverseGraph(graph);
        expect(result).toEqual(resultReverseGraph);
    });
});
