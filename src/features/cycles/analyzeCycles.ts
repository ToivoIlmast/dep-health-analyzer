import { buildCytoscapeElements } from '@features/cycles/adapters';
import { generateHtml } from '@features/cycles/visualization/generateHtml';
import { scanProject } from '@core/scanProject';
import path from 'node:path';
import { buildCycleFindings } from './findings/buildCycleFindings';
import { calculateArchitectureMetrics } from './metrics/architectureMetrics';
import { findSCCs } from './metrics/findScc';
import { getLargestSccSize } from './metrics/getLargestSccSize';
import { getModulesInCyclesCount } from './metrics/getModulesInCyclesCount';
import { printMetricsSummary } from './metrics/report';
import { ModuleMetrics } from './metrics/types';
import { ModeType, MODES } from '@shared/types';
import { getReportOutputExcludePatterns } from '@shared/getReportOutputExcludePatterns';

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

// F14/2.2: the trigger is modulesInCycles (the monotone metric), never
// cyclesCount (the SCC count) - PLAN_post_v0.11.0.md's own "not by SCC
// count". Strictly greater-than: a project sitting exactly AT its
// configured threshold still passes, only crossing it fails. failOn's own
// three-level severity is unchanged - 'info' still never fails regardless
// of the count, 'warning'/'error' still behave identically to each other.
function shouldFail(args: {
    modulesInCycles: number;
    modulesInCyclesThreshold: number;
    failOn: 'info' | 'warning' | 'error';
}): boolean {
    const { modulesInCycles, modulesInCyclesThreshold, failOn } = args;

    if (modulesInCycles <= modulesInCyclesThreshold) {
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
    includeTypeOnlyImports?: boolean;
    exclude?: string[];
    modulesInCyclesThreshold: number;
};

export async function analyzeCycles(args: AnalyzeCyclesType): Promise<boolean> {
    const {
        target,
        mode,
        failOn,
        enableHtmlReport,
        htmlReportOutputPath,
        includeTypeOnlyImports,
        exclude,
        modulesInCyclesThreshold,
    } = args;

    // F4/F26: the tool's own generated HTML report (and, for `cycles`, the
    // vendored assets copied alongside it - see copyAssets.ts) must never
    // be re-discovered as project source, whether it already exists from a
    // previous run or is only about to be created by this one. Merged into
    // a NEW array (never mutating the caller's `exclude`), so a shared
    // config.exclude array can't grow across repeated calls.
    const result = await scanProject({
        scanRoot: target,
        projectRoot: process.cwd(),
        includeTypeOnlyImports,
        exclude: [...(exclude ?? []), ...getReportOutputExcludePatterns(target, htmlReportOutputPath)],
    });
    console.log(`Scanned files: ${result.scannedFiles}`);
    console.log(`Modules: ${result.graph.nodes.size}`);

    const unresolvedImports = result.unresolvedImports ?? [];

    if (unresolvedImports.length > 0) {
        console.warn(
            `${YELLOW}\nWarning: analysis incomplete - ${unresolvedImports.length} unresolved import(s):${RESET}`
        );

        for (const entry of unresolvedImports) {
            console.warn(`${YELLOW}  ${path.relative(process.cwd(), entry.file)} -> ${entry.specifier}${RESET}`);
        }
    }

    // P1-1 fix: every number below - the CLI's own "Cycles detected" line,
    // exit code/failOn, the HTML summary, and the Findings list - now comes
    // from this SAME findSCCs()+buildCycleFindings() computation, never
    // from detectCycles() (a naive DFS back-edge enumerator that counts
    // something genuinely different: individual back-edges hit during a
    // single shared-visited-set traversal, not cyclic components - it can
    // both undercount when cycles share a node, e.g. A->B->C->A plus
    // A->D->A is genuinely one 4-node SCC but detectCycles reports two
    // separate 3-node/2-node cycles, and disagree with "Largest SCC" for a
    // self-loop, see realCycles.ts). "Cycles detected: N" means exactly
    // "N real cyclic strongly-connected components" - the same N as
    // findings.sccs.length and the HTML report's own SCC count, always, by
    // construction, since they're literally the same array.
    const sccs = findSCCs(result.graph);
    const findings = buildCycleFindings({ graph: result.graph, sccs });
    const cyclesCount = findings.sccs.length;

    console.log(`Dependencies: ${findings.dependencyCount}`);

    // F1b: distinct from F1's unresolvedImports warning (a specific "THIS
    // import failed to resolve" diagnosis). This is the general case that
    // diagnosis doesn't cover - e.g. a CommonJS project using require(),
    // which extractImports() never even looks at, so nothing is ever
    // "unresolved"; it just silently finds zero edges. Not an error by
    // itself (a project can genuinely have zero internal dependencies) -
    // only worth flagging when there was real source to find them in.
    // Independent of the unresolvedImports warning above: both can fire
    // together, each naming its own real diagnostic cause.
    if (result.scannedFiles > 0 && findings.dependencyCount === 0) {
        console.warn(
            `${YELLOW}\nWarning: no dependencies detected in ${result.scannedFiles} scanned file(s) - analysis may be incomplete (e.g. CommonJS require() or another unsupported import pattern is not analyzed).${RESET}`
        );
    }

    console.log(`Cycles detected: ${cyclesCount}`);

    const largestScc = getLargestSccSize(sccs, result.graph);
    console.log(`Largest SCC: ${largestScc} module(s)`);

    // F14: the one headline number that is monotone - fusing two cycles
    // into a bigger SCC (which makes "Cycles detected" drop and can read as
    // an improvement) never decreases this, since it sums every real
    // cyclic SCC's own member count rather than counting SCCs.
    const modulesInCycles = getModulesInCyclesCount(sccs, result.graph);
    console.log(`Modules in cycles: ${modulesInCycles} module(s)`);

    const instabilityMetrics = calculateArchitectureMetrics(result.graph);

    const failed = shouldFail({ modulesInCycles, modulesInCyclesThreshold, failOn });

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
            projectRoot: process.cwd(),
        });

        generateHtml({ graph: elements, findings, outputPath: htmlReportOutputPath, unresolvedImports });
    }

    return failed;
}
