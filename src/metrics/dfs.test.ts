import { depthFirstSearch, DFSContext } from './dfs';
import { Graph } from './types';

describe('depthFirstSearch', () => {
    let context: DFSContext;

    beforeEach(() => {
        context = {
            graph: new Map(),
            visited: new Set(),
            result: [],
        };
    });

    it('visits all reachable nodes in a linear graph', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set()],
        ]);
        context.graph = graph;

        const expected = ['A', 'B', 'C'];
        depthFirstSearch('A', context);

        expect(context.result).toEqual(expected);
        expect(context.visited).toEqual(new Set(['A', 'B', 'C']));
    });

    it('correctly traverses cyclic graphs', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set(['A'])],
        ]);
        context.graph = graph;

        const expectedVisited = new Set(['A', 'B', 'C']);
        depthFirstSearch('A', context);

        expect(context.visited).toEqual(expectedVisited);
        expect(context.result.length).toBe(3);
        expect(context.result.length).toEqual(expectedVisited.size);
    });

    it('does not revisit already visited nodes', () => {
        // `A` -> `B` -> `D`
        //   \
        //    -> C -> D
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B', 'C'])],
            ['B', new Set(['D'])],
            ['C', new Set(['D'])],
            ['D', new Set()],
        ]);
        context.graph = graph;
        const expectedVisited = new Set(['A', 'B', 'C', 'D']);

        depthFirstSearch('A', context);

        expect(context.visited).toEqual(expectedVisited);
        expect(context.result.filter((node) => node === 'D')).toHaveLength(1);
    });

    it('handles isolated nodes', () => {
        const graph: Graph = new Map<string, Set<string>>([['A', new Set()]]);
        context.graph = graph;

        const expectedVisited = new Set(['A']);

        depthFirstSearch('A', context);

        expect(context.visited).toEqual(expectedVisited);
        expect(context.result).toEqual(['A']);
    });

    it('returns immediately for already visited nodes', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set()],
        ]);
        context.graph = graph;
        context.visited = new Set(['A']);

        const expectedVisited = new Set(['A']);

        depthFirstSearch('A', context);

        expect(context.visited).toEqual(expectedVisited);
        expect(context.result).toEqual([]);
    });

    it('fills finish order when order array is provided', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set()],
        ]);
        context.graph = graph;
        context.order = [];

        const expectedOrder = ['C', 'B', 'A'];

        depthFirstSearch('A', context);

        expect(context.order).toEqual(expectedOrder);
    });

    it('does not fail on empty neighbor sets', () => {
        const graph: Graph = new Map<string, Set<string>>([['A', new Set()]]);
        context.graph = graph;

        depthFirstSearch('A', context);

        expect(context.visited).toEqual(new Set(['A']));
        expect(context.result).toEqual(['A']);
    });

    it('handles graphs with branching dependencies', () => {
        //    A
        //   / \
        //  B   C
        // /     \
        // D      E
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B', 'C'])],
            ['B', new Set(['D'])],
            ['C', new Set(['E'])],
            ['D', new Set()],
            ['E', new Set()],
        ]);
        context.graph = graph;

        const expectedVisited = new Set(['A', 'B', 'C', 'D', 'E']);

        depthFirstSearch('A', context);

        expect(context.visited).toEqual(expectedVisited);
        expect(context.result.length).toEqual(expectedVisited.size);
    });

    it('correctly traverses disconnected graph regions', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set()],

            ['C', new Set(['D'])],
            ['D', new Set()],
        ]);
        context.graph = graph;

        depthFirstSearch('A', context);

        expect(context.visited).toEqual(new Set(['A', 'B']));
        expect(context.result).toEqual(['A', 'B']);
    });

    it('handles nodes missing from the graph map', () => {
        const graph: Graph = new Map<string, Set<string>>([['A', new Set(['B'])]]);
        context.graph = graph;

        depthFirstSearch('A', context);

        expect(context.visited).toEqual(new Set(['A', 'B']));
        expect(context.result).toEqual(['A', 'B']);
    });

    it('correctly processes graphs with multiple outgoing edges', () => {
        //    A
        //  / | \
        // B  C  D
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B', 'C', 'D'])],
            ['B', new Set()],
            ['C', new Set()],
            ['D', new Set()],
        ]);
        context.graph = graph;

        depthFirstSearch('A', context);

        expect(context.visited).toEqual(new Set(['A', 'B', 'C', 'D']));
        expect(context.result.length).toBe(4);
    });

    it('correctly updates both result and order arrays', () => {
        const graph: Graph = new Map<string, Set<string>>([
            ['A', new Set(['B'])],
            ['B', new Set(['C'])],
            ['C', new Set()],
        ]);
        context.graph = graph;
        context.order = [];

        depthFirstSearch('A', context);

        expect(context.result).toEqual(['A', 'B', 'C']);
        expect(context.order).toEqual(['C', 'B', 'A']);
    });
});
