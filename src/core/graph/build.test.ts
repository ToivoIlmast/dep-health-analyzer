import { addEdge } from './build';
import type { DependencyGraph } from './types';

describe('addEdge', () => {
    it('should add nodes and edge', () => {
        const mockGraph: DependencyGraph = {
            nodes: new Set(),
            edges: new Map(),
        };

        addEdge(mockGraph, 'a', 'b');

        expect(mockGraph.nodes.has('a')).toBe(true);
        expect(mockGraph.nodes.has('b')).toBe(true);

        expect(mockGraph.edges.get('a')?.has('b')).toBe(true);
    });

    it('should not duplicate edges', () => {
        const mockGraph: DependencyGraph = {
            nodes: new Set(),
            edges: new Map(),
        };

        addEdge(mockGraph, 'a', 'b');
        addEdge(mockGraph, 'a', 'b');

        expect(mockGraph.edges.get('a')?.size).toBe(1);
    });
});
