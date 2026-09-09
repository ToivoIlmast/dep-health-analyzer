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

    it('filters out trivial size-1 "SCCs" (a node not part of any real cycle)', () => {
        // findSCCs() (Kosaraju) returns a size-1 component for every node
        // that isn't part of a real cycle - that's the case that must stay
        // filtered out, not "anything smaller than 3".
        const graph: DependencyGraph = {
            nodes: new Set(['A', 'B']),
            edges: new Map<string, Set<string>>([['A', new Set(['B'])], ['B', new Set()]]),
        };

        const sccs = [['A'], ['B']];

        const metrics = new Map<string, ModuleMetrics>([
            ['A', { ca: 0, ce: 1, instability: 1 }],
            ['B', { ca: 1, ce: 0, instability: 0 }],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes.filter((node) => node.classes === 'scc').length).toBe(0);
    });

    it('assigns SCC classes to a real 2-node cycle - the CLI already reports this as a real cycle and the graph must show it too', () => {
        // A direct real bug: the previous `scc.length > 2` filter treated a
        // 2-node cycle (A <-> B, the single most common real-world circular
        // import shape) exactly like an ordinary, non-cyclic node - no
        // color, no `.scc` class - even though `cycles`' own "Cycles
        // detected"/"Largest SCC" text output correctly reported it. Fixed
        // to `> 1`, which only ever excludes the genuinely non-cyclic
        // size-1 case above.
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

        expect(result.nodes.filter((node) => node.classes === 'scc').length).toBe(2);
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

    it('uses basename labels for every node, not just high-degree ones', () => {
        // A real bug: labels used to be gated behind `degree > 3`, so on a
        // normal-sized project (where most files have low degree) most
        // nodes rendered with no label at all - the reader couldn't tell
        // which module/file most of the graph even was without hovering
        // every node one at a time. Every node now gets its own short,
        // real basename regardless of degree.
        const graph: DependencyGraph = {
            nodes: new Set(['/src/app/service.ts', '/src/app/b.ts', 'C', 'D', 'E']),
            edges: new Map<string, Set<string>>([
                ['/src/app/service.ts', new Set(['/src/app/b.ts', 'C', 'D', 'E'])],
                ['/src/app/b.ts', new Set()],
                ['C', new Set()],
                ['D', new Set()],
                ['E', new Set()],
            ]),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>([
            ['/src/app/service.ts', { ca: 0, ce: 4, instability: 1 }],
            ['/src/app/b.ts', { ca: 1, ce: 0, instability: 0 }],
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
        const bNode = result.nodes.find((node) => node.data.id === '/src/app/b.ts');

        expect(result.nodes.filter((node) => node.data.label !== '').length).toBe(5);
        expect(serviceNode?.data.label).toBe('service.ts');
        expect(bNode?.data.label).toBe('b.ts');
    });

    it('includes a fully isolated file (zero imports, zero importers) - not just nodes that appear in the edges map', () => {
        // addEdge only ever creates an edges-map entry for a "from" node
        // that has at least one resolvable import, so a genuinely isolated
        // file (no imports, imported by nothing) never becomes a key or a
        // neighbor value anywhere in graph.edges - it only exists in
        // graph.nodes. Deriving the node set from graph.edges instead of
        // graph.nodes would silently drop it from the report.
        const graph: DependencyGraph = {
            nodes: new Set(['connected.ts', 'consumer.ts', 'lonely.ts']),
            edges: new Map<string, Set<string>>([['consumer.ts', new Set(['connected.ts'])]]),
        };

        const sccs: string[][] = [];

        const metrics = new Map<string, ModuleMetrics>([
            ['connected.ts', { ca: 1, ce: 0, instability: 0 }],
            ['consumer.ts', { ca: 0, ce: 1, instability: 1 }],
        ]);

        const result = buildCytoscapeElements({
            graph,
            metrics,
            sccs,
        });

        expect(result.nodes.length).toBe(3);
        expect(result.nodes.some((node) => node.data.id === 'lonely.ts')).toBe(true);
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

    describe('module area (structural, derived from each node\'s own path)', () => {
        it('reads the area as the segment after a leading "src" wrapper', () => {
            const graph: DependencyGraph = {
                nodes: new Set(['/src/core/scanner/discover.ts', '/src/features/cycles/analyze.ts']),
                edges: new Map<string, Set<string>>(),
            };
            const metrics = new Map<string, ModuleMetrics>([
                ['/src/core/scanner/discover.ts', { ca: 0, ce: 0, instability: 0 }],
                ['/src/features/cycles/analyze.ts', { ca: 0, ce: 0, instability: 0 }],
            ]);

            const result = buildCytoscapeElements({ graph, metrics, sccs: [] });

            const core = result.nodes.find((node) => node.data.id === '/src/core/scanner/discover.ts');
            const features = result.nodes.find((node) => node.data.id === '/src/features/cycles/analyze.ts');

            expect(core?.data.area).toBe('core');
            expect(features?.data.area).toBe('features');
        });

        it('does not assume a "src" wrapper - a top-level folder outside src is its own area', () => {
            const graph: DependencyGraph = {
                nodes: new Set(['/scripts/build.js']),
                edges: new Map<string, Set<string>>(),
            };
            const metrics = new Map<string, ModuleMetrics>([
                ['/scripts/build.js', { ca: 0, ce: 0, instability: 0 }],
            ]);

            const result = buildCytoscapeElements({ graph, metrics, sccs: [] });

            expect(result.nodes[0]?.data.area).toBe('scripts');
        });

        it('falls back to a neutral area for a file with no directory at all', () => {
            const graph: DependencyGraph = {
                nodes: new Set(['index.ts']),
                edges: new Map<string, Set<string>>(),
            };
            const metrics = new Map<string, ModuleMetrics>([
                ['index.ts', { ca: 0, ce: 0, instability: 0 }],
            ]);

            const result = buildCytoscapeElements({ graph, metrics, sccs: [] });

            expect(result.nodes[0]?.data.area).toBe('(root)');
        });

        it('assigns the same color to the same area, deterministically', () => {
            const graph: DependencyGraph = {
                nodes: new Set(['/src/core/a.ts', '/src/core/b.ts']),
                edges: new Map<string, Set<string>>(),
            };
            const metrics = new Map<string, ModuleMetrics>([
                ['/src/core/a.ts', { ca: 0, ce: 0, instability: 0 }],
                ['/src/core/b.ts', { ca: 0, ce: 0, instability: 0 }],
            ]);

            const result = buildCytoscapeElements({ graph, metrics, sccs: [] });
            const colors = new Set(result.nodes.map((node) => node.data.areaColor));

            expect(colors.size).toBe(1);
        });

        it('gives different areas different colors, and repeats the same result across separate calls', () => {
            const graph: DependencyGraph = {
                nodes: new Set(['/src/core/a.ts', '/src/features/b.ts']),
                edges: new Map<string, Set<string>>(),
            };
            const metrics = new Map<string, ModuleMetrics>([
                ['/src/core/a.ts', { ca: 0, ce: 0, instability: 0 }],
                ['/src/features/b.ts', { ca: 0, ce: 0, instability: 0 }],
            ]);

            const first = buildCytoscapeElements({ graph, metrics, sccs: [] });
            const second = buildCytoscapeElements({ graph, metrics, sccs: [] });

            const coreColorFirst = first.nodes.find((node) => node.data.area === 'core')?.data.areaColor;
            const featuresColorFirst = first.nodes.find((node) => node.data.area === 'features')?.data.areaColor;
            const coreColorSecond = second.nodes.find((node) => node.data.area === 'core')?.data.areaColor;

            expect(coreColorFirst).not.toBe(featuresColorFirst);
            expect(coreColorFirst).toBe(coreColorSecond);
        });

        it('resolves the area relative to an explicit projectRoot when one is given', () => {
            const graph: DependencyGraph = {
                nodes: new Set(['/repo/src/core/discover.ts']),
                edges: new Map<string, Set<string>>(),
            };
            const metrics = new Map<string, ModuleMetrics>([
                ['/repo/src/core/discover.ts', { ca: 0, ce: 0, instability: 0 }],
            ]);

            const result = buildCytoscapeElements({
                graph,
                metrics,
                sccs: [],
                projectRoot: '/repo',
            });

            expect(result.nodes[0]?.data.area).toBe('core');
        });
    });
});
