import type { DependencyGraph } from '@core/graph/types';
import { findSCCs } from '@features/cycles/metrics/findScc';
import { buildCycleFindings } from './buildCycleFindings';

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

// Every consecutive pair in a cycle must be a real edge in the graph -
// this is the actual correctness check for exampleCycle, not just
// structural shape.
function assertRealPath(cycle: string[], graph: DependencyGraph): void {
    for (let i = 0; i < cycle.length - 1; i++) {
        const from = cycle[i]!;
        const to = cycle[i + 1]!;
        expect(graph.edges.get(from)?.has(to)).toBe(true);
    }
}

describe('buildCycleFindings', () => {
    it('reports zero SCCs for a project without cycles', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts'],
            'b.ts': ['c.ts'],
            'c.ts': [],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });

        expect(findings.sccs).toEqual([]);
        expect(findings.moduleCount).toBe(3);
        expect(findings.dependencyCount).toBe(2);
    });

    it('reports one finding for one real SCC', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts'],
            'b.ts': ['a.ts'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });

        expect(findings.sccs).toHaveLength(1);
        expect(findings.sccs[0]?.size).toBe(2);
        expect(findings.sccs[0]?.memberIds).toEqual(['a.ts', 'b.ts']);
    });

    it('reports one finding per independent SCC, in the same order/index as a real node\'s sccId would get', () => {
        // Two completely unrelated cycles (large-cycle-app's own real
        // shape: a 7-module ring plus an independent 2-module pair) -
        // this must never collapse them into one finding or miscount
        // which is which.
        const graph = makeGraph({
            'ring0.ts': ['ring1.ts'],
            'ring1.ts': ['ring2.ts'],
            'ring2.ts': ['ring0.ts'],
            'left.ts': ['right.ts'],
            'right.ts': ['left.ts'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });

        expect(findings.sccs).toHaveLength(2);

        const ring = findings.sccs.find((scc) => scc.size === 3);
        const pair = findings.sccs.find((scc) => scc.size === 2);

        expect(ring?.memberIds).toEqual(['ring0.ts', 'ring1.ts', 'ring2.ts']);
        expect(pair?.memberIds).toEqual(['left.ts', 'right.ts']);
    });

    it('excludes a trivial (non-cyclic) size-1 component - matches buildCytoscapeElements.ts\'s own realSccs filter', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts'],
            'b.ts': [],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });

        expect(findings.sccs).toEqual([]);
    });

    it('reports the correct size for a larger SCC', () => {
        // large-cycle-app's own real 7-module ring shape.
        const graph = makeGraph({
            'ring0.ts': ['ring1.ts'],
            'ring1.ts': ['ring2.ts'],
            'ring2.ts': ['ring3.ts'],
            'ring3.ts': ['ring4.ts'],
            'ring4.ts': ['ring5.ts'],
            'ring5.ts': ['ring6.ts'],
            'ring6.ts': ['ring0.ts'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });

        expect(findings.sccs).toHaveLength(1);
        expect(findings.sccs[0]?.size).toBe(7);
        expect(findings.sccs[0]?.memberIds).toHaveLength(7);
    });

    it('memberIds are sorted alphabetically, not left in whatever order Kosaraju happened to visit them', () => {
        const graph = makeGraph({
            zebra: ['apple'],
            apple: ['mango'],
            mango: ['zebra'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });

        expect(findings.sccs[0]?.memberIds).toEqual(['apple', 'mango', 'zebra']);
    });

    it('exampleCycle starts and ends at the same node - the cycle is guaranteed to close', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts'],
            'b.ts': ['c.ts'],
            'c.ts': ['a.ts'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });
        const cycle = findings.sccs[0]!.exampleCycle;

        expect(cycle[0]).toBe(cycle[cycle.length - 1]);
        expect(cycle.length).toBeGreaterThan(1);
    });

    it('every consecutive step in exampleCycle is a real graph edge', () => {
        const graph = makeGraph({
            'ring0.ts': ['ring1.ts'],
            'ring1.ts': ['ring2.ts'],
            'ring2.ts': ['ring3.ts'],
            'ring3.ts': ['ring4.ts'],
            'ring4.ts': ['ring5.ts'],
            'ring5.ts': ['ring6.ts'],
            'ring6.ts': ['ring0.ts'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });
        const cycle = findings.sccs[0]!.exampleCycle;

        expect(cycle).toHaveLength(8); // 7 members + the closing repeat
        assertRealPath(cycle, graph);
    });

    it('exampleCycle visits every member of the SCC exactly once before closing', () => {
        const graph = makeGraph({
            'ring0.ts': ['ring1.ts'],
            'ring1.ts': ['ring2.ts'],
            'ring2.ts': ['ring0.ts'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });
        const finding = findings.sccs[0]!;
        const cycle = finding.exampleCycle;

        expect(new Set(cycle.slice(0, -1))).toEqual(new Set(finding.memberIds));
    });

    it('is deterministic - the same input always produces the same output', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts', 'd.ts'],
            'b.ts': ['c.ts'],
            'c.ts': ['a.ts'],
            'd.ts': ['a.ts'],
        });
        const sccs = findSCCs(graph);

        const first = buildCycleFindings({ graph, sccs });
        const second = buildCycleFindings({ graph, sccs });

        expect(first).toEqual(second);
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    it('regression: A->B->C->A plus A->D->A is one 4-member SCC, not two separate findings', () => {
        // The exact case detectCycles()'s naive, shared-visited-set DFS
        // undercounts differently (it would enumerate this as two
        // separate cycles sharing node A) - findSCCs (Kosaraju) correctly
        // partitions every node into exactly one component, so this must
        // come back as ONE finding of size 4, never two.
        const graph = makeGraph({
            'a.ts': ['b.ts', 'd.ts'],
            'b.ts': ['c.ts'],
            'c.ts': ['a.ts'],
            'd.ts': ['a.ts'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });

        expect(findings.sccs).toHaveLength(1);
        expect(findings.sccs[0]?.size).toBe(4);
        expect(findings.sccs[0]?.memberIds).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
        assertRealPath(findings.sccs[0]!.exampleCycle, graph);
    });

    it('a self-loop on the alphabetically-first member does not derail the example cycle into a trivial A->A', () => {
        // 'a.ts' is both the representative-cycle start (alphabetically
        // smallest) AND has a self-loop - without explicitly excluding
        // the self-loop from the "first step out of start" choice, the
        // BFS would immediately close on the very first step, silently
        // producing [a.ts, a.ts] and hiding the SCC's real 3-member
        // structure entirely.
        const graph = makeGraph({
            'a.ts': ['a.ts', 'b.ts'],
            'b.ts': ['c.ts'],
            'c.ts': ['a.ts'],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });
        const finding = findings.sccs[0]!;

        expect(finding.size).toBe(3);
        expect(finding.exampleCycle.length).toBeGreaterThan(2);
        expect(new Set(finding.exampleCycle.slice(0, -1))).toEqual(new Set(finding.memberIds));
        assertRealPath(finding.exampleCycle, graph);
    });

    it('counts moduleCount/dependencyCount from the whole graph, independent of SCC membership', () => {
        const graph = makeGraph({
            'a.ts': ['b.ts'],
            'b.ts': ['a.ts'],
            'c.ts': ['a.ts'],
            'd.ts': [],
        });
        const sccs = findSCCs(graph);

        const findings = buildCycleFindings({ graph, sccs });

        expect(findings.moduleCount).toBe(4);
        expect(findings.dependencyCount).toBe(3);
    });
});
