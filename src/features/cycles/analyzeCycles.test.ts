import { MODES } from '@shared/types';
import type { DependencyGraph } from '@core/graph/types';
import type { ScanResult } from '@core/graph/types';

jest.mock('@core/scanProject', () => ({ scanProject: jest.fn() }));
jest.mock('./metrics/architectureMetrics', () => ({ calculateArchitectureMetrics: jest.fn() }));
jest.mock('./metrics/findScc', () => ({ findSCCs: jest.fn() }));
jest.mock('./metrics/report', () => ({ printMetricsSummary: jest.fn() }));
jest.mock('@features/cycles/adapters', () => ({ buildCytoscapeElements: jest.fn() }));
jest.mock('@features/cycles/visualization/generateHtml', () => ({ generateHtml: jest.fn() }));

import { scanProject } from '@core/scanProject';
import { calculateArchitectureMetrics } from './metrics/architectureMetrics';
import { findSCCs } from './metrics/findScc';
import { printMetricsSummary } from './metrics/report';
import { buildCytoscapeElements } from '@features/cycles/adapters';
import { generateHtml } from '@features/cycles/visualization/generateHtml';
import { analyzeCycles } from './analyzeCycles';

const mockedScanProject = jest.mocked(scanProject);
const mockedCalculateArchitectureMetrics = jest.mocked(calculateArchitectureMetrics);
const mockedFindSCCs = jest.mocked(findSCCs);
const mockedPrintMetricsSummary = jest.mocked(printMetricsSummary);
const mockedBuildCytoscapeElements = jest.mocked(buildCytoscapeElements);
const mockedGenerateHtml = jest.mocked(generateHtml);

function makeScanResult(graph?: Partial<DependencyGraph>): ScanResult {
    return {
        graph: {
            nodes: new Set(['a.ts', 'b.ts']),
            edges: new Map([['a.ts', new Set(['b.ts'])]]),
            ...graph,
        },
        scannedFiles: 2,
        root: '/project',
    };
}

const baseArgs = {
    target: '.',
    failOn: 'error' as const,
    mode: MODES.COMPACT,
    enableHtmlReport: true,
    htmlReportOutputPath: './out.html',
};

describe('analyzeCycles', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedScanProject.mockResolvedValue(makeScanResult());
        mockedCalculateArchitectureMetrics.mockReturnValue(new Map());
        mockedFindSCCs.mockReturnValue([]);
        mockedBuildCytoscapeElements.mockReturnValue({ nodes: [], edges: [] });
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should not fail when no cycles are detected, regardless of failOn', async () => {
        mockedFindSCCs.mockReturnValue([]);

        const failed = await analyzeCycles({ ...baseArgs, failOn: 'error' });

        expect(failed).toBe(false);
    });

    it.each(['warning', 'error'] as const)(
        'should fail when cycles exist and failOn is %s',
        async (failOn) => {
            mockedScanProject.mockResolvedValue(
                makeScanResult({
                    nodes: new Set(['a.ts', 'b.ts']),
                    edges: new Map([
                        ['a.ts', new Set(['b.ts'])],
                        ['b.ts', new Set(['a.ts'])],
                    ]),
                })
            );
            mockedFindSCCs.mockReturnValue([['a.ts', 'b.ts']]);

            const failed = await analyzeCycles({ ...baseArgs, failOn });

            expect(failed).toBe(true);
        }
    );

    it('should not fail when cycles exist but failOn is info', async () => {
        mockedScanProject.mockResolvedValue(
            makeScanResult({
                nodes: new Set(['a.ts', 'b.ts']),
                edges: new Map([
                    ['a.ts', new Set(['b.ts'])],
                    ['b.ts', new Set(['a.ts'])],
                ]),
            })
        );
        mockedFindSCCs.mockReturnValue([['a.ts', 'b.ts']]);

        const failed = await analyzeCycles({ ...baseArgs, failOn: 'info' });

        expect(failed).toBe(false);
    });

    // P1-1: "Cycles detected" (the console line, exit code/failOn, and the
    // HTML findings count) must always mean the exact same thing - the
    // number of real cyclic SCCs found by findSCCs() - regardless of how
    // the underlying graph is shaped. These scenarios are the ones the
    // audit specifically called out as places a naive DFS cycle enumerator
    // (the old detectCycles()-based count) could disagree with the SCC
    // count.
    describe('unified cycle-count semantics across shapes (P1-1)', () => {
        it('A <-> B (a single 2-node mutual cycle) counts as exactly 1 cycle', async () => {
            mockedScanProject.mockResolvedValue(
                makeScanResult({
                    nodes: new Set(['a.ts', 'b.ts']),
                    edges: new Map([
                        ['a.ts', new Set(['b.ts'])],
                        ['b.ts', new Set(['a.ts'])],
                    ]),
                })
            );
            mockedFindSCCs.mockReturnValue([['a.ts', 'b.ts']]);
            const logSpy = jest.spyOn(console, 'log');

            const failed = await analyzeCycles({ ...baseArgs, failOn: 'error' });

            expect(logSpy).toHaveBeenCalledWith('Cycles detected: 1');
            expect(failed).toBe(true);
        });

        it('A <-> B plus a separate B <-> C counts as exactly 2 independent cycles, not 1 merged one', async () => {
            // A <-> B and B <-> C do NOT form one SCC (A cannot reach C:
            // there is no A->...->C path back to A through C), so a
            // correct SCC analysis reports two separate 2-node
            // components sharing node B, never one 3-node component.
            mockedScanProject.mockResolvedValue(
                makeScanResult({
                    nodes: new Set(['a.ts', 'b.ts', 'c.ts']),
                    edges: new Map([
                        ['a.ts', new Set(['b.ts'])],
                        ['b.ts', new Set(['a.ts', 'c.ts'])],
                        ['c.ts', new Set(['b.ts'])],
                    ]),
                })
            );
            mockedFindSCCs.mockReturnValue([
                ['a.ts', 'b.ts'],
                ['b.ts', 'c.ts'],
            ]);
            const logSpy = jest.spyOn(console, 'log');

            await analyzeCycles({ ...baseArgs, failOn: 'info' });

            expect(logSpy).toHaveBeenCalledWith('Cycles detected: 2');
        });

        it('overlapping cycles sharing a node (A->B->C->A plus A->D->A) count as exactly 1 cycle, not 2', async () => {
            mockedScanProject.mockResolvedValue(
                makeScanResult({
                    nodes: new Set(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
                    edges: new Map([
                        ['a.ts', new Set(['b.ts', 'd.ts'])],
                        ['b.ts', new Set(['c.ts'])],
                        ['c.ts', new Set(['a.ts'])],
                        ['d.ts', new Set(['a.ts'])],
                    ]),
                })
            );
            mockedFindSCCs.mockReturnValue([['a.ts', 'b.ts', 'c.ts', 'd.ts']]);
            const logSpy = jest.spyOn(console, 'log');

            await analyzeCycles({ ...baseArgs, failOn: 'info' });

            expect(logSpy).toHaveBeenCalledWith('Cycles detected: 1');
            expect(logSpy).toHaveBeenCalledWith('Largest SCC: 4 module(s)');
        });

        it('K4 (every node mutually reachable) counts as exactly 1 cycle of size 4', async () => {
            const members = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
            const edges = new Map(
                members.map((from) => [from, new Set(members.filter((to) => to !== from))])
            );
            mockedScanProject.mockResolvedValue(
                makeScanResult({ nodes: new Set(members), edges })
            );
            mockedFindSCCs.mockReturnValue([members]);
            const logSpy = jest.spyOn(console, 'log');

            const failed = await analyzeCycles({ ...baseArgs, failOn: 'warning' });

            expect(logSpy).toHaveBeenCalledWith('Cycles detected: 1');
            expect(logSpy).toHaveBeenCalledWith('Largest SCC: 4 module(s)');
            expect(failed).toBe(true);
        });

        it('a graph with no real cycles counts as exactly 0, exits clean, and matches Largest SCC', async () => {
            mockedScanProject.mockResolvedValue(
                makeScanResult({
                    nodes: new Set(['a.ts', 'b.ts', 'c.ts']),
                    edges: new Map([
                        ['a.ts', new Set(['b.ts'])],
                        ['b.ts', new Set(['c.ts'])],
                    ]),
                })
            );
            // findSCCs still returns trivial size-1 components for every
            // node not part of a real cycle - the shared realCycles.ts
            // filter must exclude all of them.
            mockedFindSCCs.mockReturnValue([['a.ts'], ['b.ts'], ['c.ts']]);
            const logSpy = jest.spyOn(console, 'log');

            const failed = await analyzeCycles({ ...baseArgs, failOn: 'error' });

            expect(logSpy).toHaveBeenCalledWith('Cycles detected: 0');
            expect(logSpy).toHaveBeenCalledWith('Largest SCC: 0 module(s)');
            expect(failed).toBe(false);
        });

        it('a lone self-loop (P1-2) counts as exactly 1 cycle - never 1 in the CLI while invisible in findings', async () => {
            mockedScanProject.mockResolvedValue(
                makeScanResult({
                    nodes: new Set(['self.ts']),
                    edges: new Map([['self.ts', new Set(['self.ts'])]]),
                })
            );
            mockedFindSCCs.mockReturnValue([['self.ts']]);
            const logSpy = jest.spyOn(console, 'log');

            const failed = await analyzeCycles({ ...baseArgs, failOn: 'error' });

            expect(logSpy).toHaveBeenCalledWith('Cycles detected: 1');
            expect(logSpy).toHaveBeenCalledWith('Largest SCC: 1 module(s)');
            expect(failed).toBe(true);
        });
    });

    it('should print the metrics summary with a limit of 10 in full mode', async () => {
        const metrics = new Map();
        mockedCalculateArchitectureMetrics.mockReturnValue(metrics);

        await analyzeCycles({ ...baseArgs, mode: MODES.FULL });

        expect(mockedPrintMetricsSummary).toHaveBeenCalledWith({ metrics, limit: 10 });
    });

    it('should print the metrics summary with a limit of 3 in compact mode', async () => {
        const metrics = new Map();
        mockedCalculateArchitectureMetrics.mockReturnValue(metrics);

        await analyzeCycles({ ...baseArgs, mode: MODES.COMPACT });

        expect(mockedPrintMetricsSummary).toHaveBeenCalledWith({ metrics, limit: 3 });
    });

    it('should generate an HTML report when mode is html and reporting is enabled', async () => {
        const elements = {
            nodes: [
                {
                    data: {
                        id: 'a.ts',
                        label: 'a.ts',
                        dir: '',
                        displayDir: '',
                        area: 'src',
                        areaColor: '#9ca3af',
                    },
                },
            ],
            edges: [],
        };
        mockedBuildCytoscapeElements.mockReturnValue(elements);

        await analyzeCycles({ ...baseArgs, mode: MODES.HTML, enableHtmlReport: true });

        // buildCycleFindings() is real (not mocked) - it's a small, pure
        // computation over the scanned graph, deliberately exercised for
        // real here rather than mocked, so this test also catches
        // findings/analyzeCycles drifting apart. Derived from
        // makeScanResult()'s own graph (2 nodes, 1 edge) with findSCCs
        // mocked to return no SCCs.
        expect(mockedGenerateHtml).toHaveBeenCalledWith({
            graph: elements,
            findings: { moduleCount: 2, dependencyCount: 1, sccs: [] },
            outputPath: './out.html',
        });
    });

    it('should warn and skip the report when html mode is requested but disabled in config', async () => {
        mockedScanProject.mockResolvedValue(
            makeScanResult({
                nodes: new Set(['a.ts', 'b.ts']),
                edges: new Map([
                    ['a.ts', new Set(['b.ts'])],
                    ['b.ts', new Set(['a.ts'])],
                ]),
            })
        );
        mockedFindSCCs.mockReturnValue([['a.ts', 'b.ts']]);
        const warnSpy = jest.spyOn(console, 'warn');

        const failed = await analyzeCycles({
            ...baseArgs,
            mode: MODES.HTML,
            enableHtmlReport: false,
        });

        expect(failed).toBe(true);
        expect(mockedGenerateHtml).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HTML reporting is disabled in config.')
        );
    });

    it('should compute the largest SCC size from findSCCs (real Kosaraju data), not detectCycles', async () => {
        mockedFindSCCs.mockReturnValue([['a.ts', 'b.ts', 'c.ts']]);
        const logSpy = jest.spyOn(console, 'log');

        await analyzeCycles({ ...baseArgs, failOn: 'info' });

        expect(logSpy).toHaveBeenCalledWith('Largest SCC: 3 module(s)');
    });

    it('should report zero as the largest SCC when there are no real cycles', async () => {
        mockedFindSCCs.mockReturnValue([]);
        const logSpy = jest.spyOn(console, 'log');

        await analyzeCycles({ ...baseArgs, failOn: 'info' });

        expect(logSpy).toHaveBeenCalledWith('Largest SCC: 0 module(s)');
    });

    it('should report the true SCC size for overlapping cycles sharing a node, not an undercount', async () => {
        // Regression test for a real bug: detectCycles (naive DFS cycle
        // enumeration) reported "3" for a graph where A->B->C->A and A->D->A
        // overlap at node A - the true SCC (via Kosaraju/findSCCs) is all 4
        // nodes, since every node reaches every other node.
        mockedFindSCCs.mockReturnValue([['a.ts', 'b.ts', 'c.ts', 'd.ts']]);
        const logSpy = jest.spyOn(console, 'log');

        await analyzeCycles({ ...baseArgs, failOn: 'info' });

        expect(logSpy).toHaveBeenCalledWith('Largest SCC: 4 module(s)');
    });

    it('should not count a trivial size-1 component (a node with no real cycle) as a Largest SCC of 1', async () => {
        mockedFindSCCs.mockReturnValue([['a.ts'], ['b.ts']]);
        const logSpy = jest.spyOn(console, 'log');

        await analyzeCycles({ ...baseArgs, failOn: 'info' });

        expect(logSpy).toHaveBeenCalledWith('Largest SCC: 0 module(s)');
    });

    it('should log the total number of dependency edges across the graph', async () => {
        mockedScanProject.mockResolvedValue(
            makeScanResult({
                nodes: new Set(['a.ts', 'b.ts', 'c.ts']),
                edges: new Map([
                    ['a.ts', new Set(['b.ts', 'c.ts'])],
                    ['b.ts', new Set(['c.ts'])],
                ]),
            })
        );
        const logSpy = jest.spyOn(console, 'log');

        await analyzeCycles({ ...baseArgs, failOn: 'info' });

        expect(logSpy).toHaveBeenCalledWith('Dependencies: 3');
    });
});
