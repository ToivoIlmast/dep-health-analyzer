import { DependencyGraph } from '@core/graph/types';
import { calculateArchitectureMetrics } from './architectureMetrics';

describe('calculateArchitectureMetrics', () => {
    it('calculates Ca for incoming dependencies', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['C'])],
                ['B', new Set(['C'])],
                ['C', new Set()],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('C')?.ca).toBe(2);
    });

    it('calculates Ce for outgoing dependencies', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B', 'C'])],
                ['B', new Set()],
                ['C', new Set()],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('A')?.ce).toBe(2);
    });

    it('calculates instability correctly', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B', 'C'])],
                ['B', new Set()],
                ['C', new Set()],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('A')?.instability).toBe(1);
    });

    it('returns metrics for every graph node', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set()],
                ['C', new Set(['D'])],
                ['D', new Set()],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);
        expect(result.has('A')).toBeTruthy();
        expect(result.has('B')).toBeTruthy();
        expect(result.has('C')).toBeTruthy();
        expect(result.has('D')).toBeTruthy();

        expect(result.size).toBe(4);
    });

    it('handles isolated modules', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A']),
            edges: new Map<string, Set<string>>([['A', new Set()]]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.has('A')).toBeTruthy();
        expect(result.get('A')?.ca).toBe(0);
        expect(result.get('A')?.ce).toBe(0);
        expect(result.get('A')?.instability).toBe(NaN);
    });

    it('handles empty graphs', () => {
        const graph: DependencyGraph = {
            nodes: new Set(),
            edges: new Map<string, Set<string>>(),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result).toEqual(new Map());
        expect(result.size).toBe(0);
    });

    it('correctly processes cyclic dependencies', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set(['A'])],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('A')).toEqual({
            ca: 1,
            ce: 1,
            instability: 0.5,
        });

        expect(result.get('B')).toEqual({
            ca: 1,
            ce: 1,
            instability: 0.5,
        });

        expect(result.get('C')).toEqual({
            ca: 1,
            ce: 1,
            instability: 0.5,
        });
    });

    it('correctly processes linear dependency chains', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set()],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('A')).toEqual({
            ca: 0,
            ce: 1,
            instability: 1,
        });

        expect(result.get('B')).toEqual({
            ca: 1,
            ce: 1,
            instability: 0.5,
        });

        expect(result.get('C')).toEqual({
            ca: 1,
            ce: 0,
            instability: 0,
        });
    });

    it('correctly processes branching dependency graphs', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B', 'C'])],
                ['B', new Set(['D'])],
                ['C', new Set(['D'])],
                ['D', new Set()],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('A')).toEqual({
            ca: 0,
            ce: 2,
            instability: 1,
        });

        expect(result.get('B')).toEqual({
            ca: 1,
            ce: 1,
            instability: 0.5,
        });

        expect(result.get('C')).toEqual({
            ca: 1,
            ce: 1,
            instability: 0.5,
        });

        expect(result.get('D')).toEqual({
            ca: 2,
            ce: 0,
            instability: 0,
        });
    });

    it('calculates zero instability for fully stable modules', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set()],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('B')?.instability).toBe(0);
    });

    it('calculates maximum instability for fully unstable modules', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set()],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('A')?.instability).toBe(1);
    });

    it('rounds instability values to two decimal places', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set(['A', 'B'])],
            ]),
        };

        const result = calculateArchitectureMetrics(graph);

        expect(result.get('C')?.instability).toBe(0.67);
    });
});
