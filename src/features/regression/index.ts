import { createBaselineWorktree } from './utils/createBaselineWorktree';
import { calculateDependencyDelta } from './delta/dependencyDelta';
import { defaultModeReport } from './ci/reporting/defaultModeReport/defaultModeReport';
import { ciModeReport } from './ci/reporting/ciModeReport';
import { htmlModeReport } from './visualization';
import { scanProject } from '@core/scanProject';
import { removeBaselineWorktree } from './utils/removeBaselineWorktree';
import { validateGitRef } from './utils/validateGitRef';
import { DependencyInsight, RegressionThresholds } from './types';
import { ModeType, MODES } from '@shared/types';
import { buildDependencyInsights } from './delta/insights/buildDependencyInsights';
import { execSync } from 'node:child_process';
import path from 'node:path';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

type ReportContext = {
    failed: boolean;
    delta: DependencyInsight[];
    isHtmlReportingEnabled?: boolean;
    htmlReportingOutputPath: string;
    target: string;
    baselineRef: string;
    currentScannedFiles: number;
    baselineScannedFiles: number;
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
                currentScannedFiles: ctx.currentScannedFiles,
                baselineScannedFiles: ctx.baselineScannedFiles,
            });
        console.warn(`${YELLOW}\nHTML reporting is disabled in config.\n${RESET}`);
        return;
    },
    [MODES.COMPACT]: (ctx) => ciModeReport(ctx),
};

function resolveBaselineTarget(worktree: string, target: string): string {
    const repoRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8',
    }).trim();

    const currentDir = process.cwd();

    const relativeProjectPath = path.relative(repoRoot, currentDir);

    const normalizedTarget = target.replace(/^\.?\//, '');

    return path.join(worktree, relativeProjectPath, normalizedTarget);
}

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
    const baseline = await scanProject(resolveBaselineTarget(worktree, target));
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
        currentScannedFiles: current.scannedFiles,
        baselineScannedFiles: baseline.scannedFiles,
    });

    return failed;
}
