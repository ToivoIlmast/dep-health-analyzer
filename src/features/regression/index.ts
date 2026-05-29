import { createBaselineWorktree } from './utils/createBaselineWorktree';
import { calculateDependencyDelta } from './delta/dependency-delta';
import { buildDependencyInsights } from './delta/buildDependencyInsights';
import { defaultModeReport } from './ci/reporting/defaultModeReport';
import { ciModeReport } from './ci/reporting/ciModeReport';
import { htmlModeReport } from './visualization';
import { scanProject } from '@core/scanProject';
import { removeBaselineWorktree } from './utils/removeBaselineWorktree';
import { validateGitRef } from './utils/validateGitRef';
import { DependencyInsight, RegressionThresholds } from './types';
import { ModeType, MODES } from '@shared/types';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

type ReportContext = {
    failed: boolean;
    delta: DependencyInsight[];
    isHtmlReportingEnabled?: boolean;
    htmlReportingOutputPath: string;
    target: string;
    baselineRef: string;
};
type ReportHandler = (ctx: ReportContext) => boolean | null | void;
const handlers: Record<ModeType, ReportHandler> = {
    [MODES.FULL]: (ctx) => defaultModeReport(ctx),
    [MODES.HTML]: (ctx) => {
        if (ctx.isHtmlReportingEnabled)
            return htmlModeReport({
                delta: ctx.delta,
                outputPath: ctx.htmlReportingOutputPath,
                target: ctx.target,
                baselineRef: ctx.baselineRef,
            });
        console.warn(`${YELLOW}\nHTML reporting is disabled in config.\n${RESET}`);
        return;
    },
    [MODES.COMPACT]: (ctx) => ciModeReport(ctx),
};

const severityRank = {
    info: 1,
    warning: 2,
    error: 3,
};

type ShouldFailType = {
    findings: DependencyInsight[];
    failOn: 'info' | 'warning' | 'error';
};
function shouldFail(args: ShouldFailType): boolean {
    const { findings, failOn } = args;
    const failLevel = severityRank[failOn];

    return findings.some((finding) => {
        const level = severityRank[finding.severity];
        return level >= failLevel;
    });
}

type AnalyzeRegressionType = {
    target: string;
    baselineRef: string;
    mode: ModeType;
    failOn: 'info' | 'warning' | 'error';
    rules: {
        thresholds: RegressionThresholds;
        severity: {
            'cross-boundary': 'info' | 'warning' | 'error';
            'deep-internal': 'info' | 'warning' | 'error';
            sibling: 'info' | 'warning' | 'error';
            internal: 'info' | 'warning' | 'error';
        };
    };
    isHtmlReportingEnabled: boolean;
    htmlReportOutputPath: string;
};
export async function analyzeRegression(args: AnalyzeRegressionType): Promise<boolean> {
    const {
        target,
        mode,
        baselineRef,
        rules,
        failOn,
        isHtmlReportingEnabled,
        htmlReportOutputPath,
    } = args;

    if (!validateGitRef(baselineRef) && baselineRef) {
        console.error(`Invalid git reference: ${baselineRef}`);
        process.exit(1);
    }

    const current = await scanProject(target);
    console.log(`Scanned files: ${current.scannedFiles}`);
    console.log(`Modules: ${current.graph.nodes.size}`);

    const worktree = createBaselineWorktree(baselineRef);
    const baseline = await scanProject(worktree);
    removeBaselineWorktree(worktree);

    console.log(`Scanned files: ${baseline.scannedFiles}`);
    console.log(`Modules: ${baseline.graph.nodes.size}`);

    const delta = calculateDependencyDelta({
        current,
        baseline,
    });

    const findings = buildDependencyInsights(delta, rules);
    const handler = handlers[mode];

    const failed = shouldFail({
        findings: findings,
        failOn,
    });

    handler({
        delta: findings,
        failed,
        isHtmlReportingEnabled,
        htmlReportingOutputPath: htmlReportOutputPath,
        target,
        baselineRef,
    });

    return failed;
}
