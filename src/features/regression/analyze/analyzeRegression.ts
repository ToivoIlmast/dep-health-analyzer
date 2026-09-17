import { createBaselineWorktree } from '../utils/createBaselineWorktree';
import { calculateDependencyDelta } from '../delta/dependencyDelta';
import { defaultModeReport } from '../ci/reporting/defaultModeReport/defaultModeReport';
import { ciModeReport } from '../ci/reporting/ciModeReport';
import { htmlModeReport } from '../visualization';
import { scanProject } from '@core/scanProject';
import { removeBaselineWorktree } from '../utils/removeBaselineWorktree';
import { resolveWorktreeTarget } from '../utils/resolveWorktreeTarget';
import { shouldFail } from '../utils/shouldFail';
import { validateGitRef } from '../utils/validateGitRef';
import { DependencyInsight, RegressionAnalysisResult, RegressionThresholds } from '../types';
import type { ScanResult } from '@core/graph/types';
import { ModeType, MODES, IRegressionScope } from '@shared/types';
import { buildDependencyInsights } from '../delta/insights/buildDependencyInsights';
import { execFileSync } from 'node:child_process';

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

function resolveBaselineInfo(ref: string): {
    sha: string;
    title: string;
} {
    const sha = execFileSync('git', ['rev-parse', ref], {
        encoding: 'utf8',
    }).trim();

    const title = execFileSync('git', ['log', '-1', '--pretty=%s', sha], {
        encoding: 'utf8',
    }).trim();

    return { sha, title };
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
    scopes?: Array<IRegressionScope>;
    includeTypeOnlyImports?: boolean;
    exclude?: string[];
};
export async function analyzeRegression(
    args: AnalyzeRegressionType
): Promise<RegressionAnalysisResult> {
    const {
        target,
        mode,
        baselineRef,
        rules,
        failOn,
        isHtmlReportingEnabled,
        htmlReportOutputPath,
        scopes,
        includeTypeOnlyImports,
        exclude,
    } = args;

    if (!validateGitRef(baselineRef) && baselineRef) {
        console.error(`Invalid git reference: ${baselineRef}`);
        process.exit(1);
    }

    const baselineInfo = resolveBaselineInfo(baselineRef);

    console.log('Baseline:');
    console.log(`  ${baselineRef}`);
    console.log(`  → ${baselineInfo.sha.slice(0, 7)} (${baselineInfo.title})`);
    console.log();

    const currentProjectRoot = process.cwd();
    const current = await scanProject({
        scanRoot: target,
        projectRoot: currentProjectRoot,
        includeTypeOnlyImports,
        exclude,
    });
    console.log(`Scanned files: ${current.scannedFiles}`);
    console.log(`Modules: ${current.graph.nodes.size}`);

    const worktree = createBaselineWorktree(baselineRef);

    let baseline: ScanResult;
    try {
        baseline = await scanProject({
            scanRoot: resolveWorktreeTarget(worktree, target),
            projectRoot: worktree,
            includeTypeOnlyImports,
            exclude,
        });
    } finally {
        removeBaselineWorktree(worktree);
    }

    console.log(`Scanned files: ${baseline.scannedFiles}`);
    console.log(`Modules: ${baseline.graph.nodes.size}`);

    // F3 (AUDIT_v0.11.0.md), defence in depth: a broken baseline scan (0
    // files) makes every current dependency look newly "added" -
    // calculateDependencyDelta has no way to tell "nothing existed before"
    // apart from "the baseline scan itself is broken". Refuse to present
    // those as trustworthy findings rather than let a scan failure look
    // like a real architectural regression. A current scan that is ALSO
    // empty is a different (genuinely empty project) case, not this one.
    if (baseline.scannedFiles === 0 && current.scannedFiles > 0) {
        console.error(
            `Baseline scan at "${baselineRef}" found 0 files while the current scan found ${current.scannedFiles} - refusing to compare against an empty baseline (every existing dependency would otherwise look newly added). Check that --target resolves correctly inside the baseline worktree.`
        );
        process.exit(1);
        return { failed: true, findings: [] };
    }

    const delta = calculateDependencyDelta({
        current,
        baseline,
    });

    const findings = buildDependencyInsights(delta, rules, scopes);
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

    return {
        failed,
        findings,
    };
}
