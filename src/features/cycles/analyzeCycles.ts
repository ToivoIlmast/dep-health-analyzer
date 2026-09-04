import { buildCytoscapeElements } from '@features/cycles/adapters';
import { generateHtml } from '@features/cycles/visualization/generateHtml';
import { scanProject } from '@core/scanProject';
import { detectCycles } from './detectCycles';
import { calculateArchitectureMetrics } from './metrics/architectureMetrics';
import { findSCCs } from './metrics/findScc';
import { getLargestSccSize } from './metrics/getLargestSccSize';
import { printMetricsSummary } from './metrics/report';
import { ModuleMetrics } from './metrics/types';
import { ModeType, MODES } from '@shared/types';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

type ReportContext = {
    metrics: Map<string, ModuleMetrics>;
    limit?: number;
};
type ReportHandler = (ctx: ReportContext) => void;
const handlers: Record<ModeType, ReportHandler> = {
    [MODES.FULL]: (ctx) => {
        return printMetricsSummary({
            ...ctx,
            limit: 10,
        });
    },
    [MODES.COMPACT]: (ctx) => {
        return printMetricsSummary({
            ...ctx,
            limit: 3,
        });
    },
    [MODES.HTML]: () => {
        return;
    },
};

function shouldFail(args: { cyclesCount: number; failOn: 'info' | 'warning' | 'error' }): boolean {
    const { cyclesCount, failOn } = args;

    if (cyclesCount === 0) {
        return false;
    }

    switch (failOn) {
        case 'info':
            return false;
        case 'warning':
        case 'error':
            return true;
    }
}

type AnalyzeCyclesType = {
    target: string;
    failOn: 'info' | 'warning' | 'error';
    mode: ModeType;
    enableHtmlReport: boolean;
    htmlReportOutputPath: string;
};

export async function analyzeCycles(args: AnalyzeCyclesType): Promise<boolean> {
    const { target, mode, failOn, enableHtmlReport, htmlReportOutputPath } = args;

    const result = await scanProject({ scanRoot: target, projectRoot: process.cwd() });
    const cycles = detectCycles(result.graph);
    result.cycles = cycles;

    console.log(`Scanned files: ${result.scannedFiles}`);
    console.log(`Modules: ${result.graph.nodes.size}`);

    let edgesCount = 0;
    for (const deps of result.graph.edges.values()) {
        edgesCount += deps.size;
    }

    console.log(`Dependencies: ${edgesCount}`);
    console.log(`Cycles detected: ${result.cycles.length}`);

    // detectCycles enumerates individual cycles via a naive DFS, which can
    // undercount true architectural entanglement when cycles share a node
    // (e.g. A->B->C->A plus A->D->A is genuinely one 4-node SCC, but
    // detectCycles reports two separate 3-node/2-node cycles). findSCCs runs
    // the real Kosaraju algorithm, so "Largest SCC" is computed from that
    // instead - and reused below for the HTML report, so both stay
    // consistent with each other by construction.
    const sccs = findSCCs(result.graph);
    const largestScc = getLargestSccSize(sccs, result.graph);
    console.log(`Largest SCC: ${largestScc} module(s)`);
    const instabilityMetrics = calculateArchitectureMetrics(result.graph);

    const failed = shouldFail({ cyclesCount: result.cycles.length, failOn });

    const handler = handlers[mode];
    handler({ metrics: instabilityMetrics });

    if (mode === MODES.HTML) {
        if (!enableHtmlReport) {
            console.warn(`${YELLOW}\nHTML reporting is disabled in config.\n${RESET}`);
            return failed;
        }

        const elements = buildCytoscapeElements({
            graph: result.graph,
            metrics: instabilityMetrics,
            sccs,
        });

        generateHtml({ graph: elements, outputPath: htmlReportOutputPath });
    }

    return failed;
}
