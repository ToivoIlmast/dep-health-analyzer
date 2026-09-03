import { MODES } from '@shared/types';
import type { DependencyGraph } from '@core/graph/types';
import type { ScanResult } from '@core/graph/types';

jest.mock('@core/scanProject', () => ({ scanProject: jest.fn() }));
jest.mock('./detectCycles', () => ({ detectCycles: jest.fn() }));
jest.mock('./metrics/architectureMetrics', () => ({ calculateArchitectureMetrics: jest.fn() }));
jest.mock('./metrics/findScc', () => ({ findSCCs: jest.fn() }));
jest.mock('./metrics/report', () => ({ printMetricsSummary: jest.fn() }));
jest.mock('@features/cycles/adapters', () => ({ buildCytoscapeElements: jest.fn() }));
jest.mock('@features/cycles/visualization/generateHtml', () => ({ generateHtml: jest.fn() }));

import { scanProject } from '@core/scanProject';
import { detectCycles } from './detectCycles';
import { calculateArchitectureMetrics } from './metrics/architectureMetrics';
import { findSCCs } from './metrics/findScc';
import { printMetricsSummary } from './metrics/report';
import { buildCytoscapeElements } from '@features/cycles/adapters';
import { generateHtml } from '@features/cycles/visualization/generateHtml';
import { analyzeCycles } from './analyzeCycles';

const mockedScanProject = jest.mocked(scanProject);
const mockedDetectCycles = jest.mocked(detectCycles);
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
        mockedDetectCycles.mockReturnValue([]);
        mockedFindSCCs.mockReturnValue([]);
        mockedBuildCytoscapeElements.mockReturnValue({ nodes: [], edges: [] });
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should not fail when no cycles are detected, regardless of failOn', async () => {
        mockedDetectCycles.mockReturnValue([]);

        const failed = await analyzeCycles({ ...baseArgs, failOn: 'error' });

        expect(failed).toBe(false);
    });

    it.each(['warning', 'error'] as const)(
        'should fail when cycles exist and failOn is %s',
        async (failOn) => {
            mockedDetectCycles.mockReturnValue([['a.ts', 'b.ts', 'a.ts']]);

            const failed = await analyzeCycles({ ...baseArgs, failOn });

            expect(failed).toBe(true);
        }
    );

    it('should not fail when cycles exist but failOn is info', async () => {
        mockedDetectCycles.mockReturnValue([['a.ts', 'b.ts', 'a.ts']]);

        const failed = await analyzeCycles({ ...baseArgs, failOn: 'info' });

        expect(failed).toBe(false);
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
        const elements = { nodes: [{ data: { id: 'a.ts', label: 'a.ts' } }], edges: [] };
        mockedBuildCytoscapeElements.mockReturnValue(elements);

        await analyzeCycles({ ...baseArgs, mode: MODES.HTML, enableHtmlReport: true });

        expect(mockedGenerateHtml).toHaveBeenCalledWith({
            graph: elements,
            outputPath: './out.html',
        });
    });

    it('should warn and skip the report when html mode is requested but disabled in config', async () => {
        mockedDetectCycles.mockReturnValue([['a.ts', 'b.ts', 'a.ts']]);
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

    it('should compute the largest SCC size from the longest detected cycle', async () => {
        // detectCycles repeats the first node at the end of each cycle array
        // (e.g. a 2-module cycle is ['a.ts', 'b.ts', 'a.ts']) - the count
        // must be the number of distinct modules, not the raw array length.
        mockedDetectCycles.mockReturnValue([
            ['a.ts', 'b.ts', 'a.ts'],
            ['x.ts', 'y.ts', 'z.ts', 'x.ts'],
        ]);
        const logSpy = jest.spyOn(console, 'log');

        await analyzeCycles({ ...baseArgs, failOn: 'info' });

        expect(logSpy).toHaveBeenCalledWith('Largest SCC: 3 module(s)');
    });

    it('should report zero as the largest SCC when there are no cycles', async () => {
        mockedDetectCycles.mockReturnValue([]);
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
