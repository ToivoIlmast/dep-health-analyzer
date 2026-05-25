import { DependencyGraph } from '@core/graph/types';
import { buildCytoscapeElements } from './buildCytoscapeElements';
import { ModuleMetrics } from '@features/cycles/metrics/types';

describe('buildCytoscapeElements', () => {
    it('builds both nodes and edges', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set()],
            ]),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>([
            [
                'A',
                {
                    ca: 0,
                    ce: 1,
                    instability: 1,
                },
            ],
            [
                'B',
                {
                    ca: 1,
                    ce: 0,
                    instability: 0,
                },
            ],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes).toBeDefined();
        expect(result.edges).toBeDefined();
        expect(result.nodes).toHaveLength(2);
        expect(result.edges).toHaveLength(1);
    });

    it('includes all graph nodes in the result', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set()],
            ]),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>([
            [
                'A',
                {
                    ca: 0,
                    ce: 1,
                    instability: 1,
                },
            ],
            [
                'B',
                {
                    ca: 1,
                    ce: 1,
                    instability: 0.5,
                },
            ],
            [
                'C',
                {
                    ca: 1,
                    ce: 0,
                    instability: 0,
                },
            ],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes.length).toBe(3);
        expect(result.nodes.filter((node) => node.data.id === 'A').length).toBe(1);
        expect(result.nodes.filter((node) => node.data.id === 'B').length).toBe(1);
        expect(result.nodes.filter((node) => node.data.id === 'C').length).toBe(1);
    });

    it('includes all graph edges in the result', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B', 'C'])],
                ['B', new Set(['C'])],
                ['C', new Set()],
            ]),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>([
            ['A', { ca: 0, ce: 2, instability: 1 }],
            ['B', { ca: 1, ce: 1, instability: 0.5 }],
            ['C', { ca: 2, ce: 0, instability: 0 }],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.edges.length).toBe(3);
        expect(
            result.edges.filter((edge) => edge.data.source === 'A' && edge.data.target === 'B')
                .length
        ).toBe(1);

        expect(
            result.edges.filter((edge) => edge.data.source === 'A' && edge.data.target === 'C')
                .length
        ).toBe(1);

        expect(
            result.edges.filter((edge) => edge.data.source === 'B' && edge.data.target === 'C')
                .length
        ).toBe(1);
    });

    it('filters out SCCs smaller than size 3', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['A'])],
            ]),
        };

        const sccs = [['A', 'B']];

        const metrics = new Map<string, ModuleMetrics>([
            ['A', { ca: 1, ce: 1, instability: 0.5 }],
            ['B', { ca: 1, ce: 1, instability: 0.5 }],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes.filter((node) => node.classes === 'scc').length).toBe(0);
    });

    it('assigns SCC classes to cyclic nodes', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set(['A'])],
            ]),
        };

        const sccs = [['A', 'B', 'C']];

        const metrics = new Map<string, ModuleMetrics>([
            ['A', { ca: 1, ce: 1, instability: 0.5 }],
            ['B', { ca: 1, ce: 1, instability: 0.5 }],
            ['C', { ca: 1, ce: 1, instability: 0.5 }],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes.filter((node) => node.classes === 'scc').length).toBe(3);
    });

    it('stores architecture metrics in node data', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A']),
            edges: new Map<string, Set<string>>([['A', new Set()]]),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>([
            [
                'A',
                {
                    ca: 5,
                    ce: 2,
                    instability: 0.29,
                },
            ],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes[0]?.data.ca).toBe(5);
        expect(result.nodes[0]?.data.ce).toBe(2);
        expect(result.nodes[0]?.data.instability).toBe(0.29);
    });

    it('calculates node sizes from module degree', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B', 'C'])],
                ['B', new Set()],
                ['C', new Set()],
            ]),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>([
            ['A', { ca: 0, ce: 2, instability: 1 }],
            ['B', { ca: 1, ce: 0, instability: 0 }],
            ['C', { ca: 1, ce: 0, instability: 0 }],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        const nodeA = result.nodes.find((node) => node.data.id === 'A');
        const nodeB = result.nodes.find((node) => node.data.id === 'B');

        expect(nodeA?.data.size).toBeGreaterThan(nodeB?.data.size ?? 0);
    });

    it('uses basename labels for high-degree nodes', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['/src/app/service.ts', 'B', 'C', 'D', 'E']),
            edges: new Map<string, Set<string>>([
                ['/src/app/service.ts', new Set(['B', 'C', 'D', 'E'])],
                ['B', new Set()],
                ['C', new Set()],
                ['D', new Set()],
                ['E', new Set()],
            ]),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>([
            ['/src/app/service.ts', { ca: 0, ce: 4, instability: 1 }],
            ['B', { ca: 1, ce: 0, instability: 0 }],
            ['C', { ca: 1, ce: 0, instability: 0 }],
            ['D', { ca: 1, ce: 0, instability: 0 }],
            ['E', { ca: 1, ce: 0, instability: 0 }],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        const serviceNode = result.nodes.find((node) => node.data.id === '/src/app/service.ts');

        expect(result.nodes.filter((node) => node.data.label !== '').length).toBe(1);
        expect(serviceNode?.data.label).toBe('service.ts');
    });

    it('handles empty graphs', () => {
        const graph: DependencyGraph = {
            nodes: new Set(),
            edges: new Map<string, Set<string>>(),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>();

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes.length).toBe(0);
        expect(result.edges.length).toBe(0);
    });

    it('correctly processes mixed SCC and non-SCC graphs', () => {
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B', 'C', 'D', 'E']),
            edges: new Map<string, Set<string>>([
                ['A', new Set(['B'])],
                ['B', new Set(['C'])],
                ['C', new Set(['A'])],

                ['D', new Set(['E'])],
                ['E', new Set()],
            ]),
        };

        const sccs = [['A', 'B', 'C']];

        const metrics = new Map<string, ModuleMetrics>([
            ['A', { ca: 1, ce: 1, instability: 0.5 }],
            ['B', { ca: 1, ce: 1, instability: 0.5 }],
            ['C', { ca: 1, ce: 1, instability: 0.5 }],
            ['D', { ca: 0, ce: 1, instability: 1 }],
            ['E', { ca: 1, ce: 0, instability: 0 }],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes.filter((node) => node.classes === 'scc').length).toBe(3);
        expect(
            result.nodes.filter((node) => node.data.id === 'A' && node.classes === 'scc').length
        ).toBe(1);
        expect(
            result.nodes.filter((node) => node.data.id === 'B' && node.classes === 'scc').length
        ).toBe(1);
        expect(
            result.nodes.filter((node) => node.data.id === 'C' && node.classes === 'scc').length
        ).toBe(1);

        expect(result.nodes.filter((node) => node.classes !== 'scc').length).toBe(2);
        expect(
            result.nodes.filter((node) => node.data.id === 'D' && node.classes !== 'scc').length
        ).toBe(1);
        expect(
            result.nodes.filter((node) => node.data.id === 'E' && node.classes !== 'scc').length
        ).toBe(1);
    });
});
