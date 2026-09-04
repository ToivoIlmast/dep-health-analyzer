import { createBaselineWorktree } from '../../utils/createBaselineWorktree';
import { removeBaselineWorktree } from '../../utils/removeBaselineWorktree';
import { resolveWorktreeTarget } from '../../utils/resolveWorktreeTarget';
import { validateGitRef } from '../../utils/validateGitRef';
import { calculateDependencyDelta } from '../../delta/dependencyDelta';
import { buildDependencyInsights } from '../../delta/insights/buildDependencyInsights';
import { scanProject } from '@core/scanProject';
import type { ScanResult } from '@core/graph/types';
import { IRegressionScope } from '@shared/types';
import { RegressionThresholds } from '../../types';
import { getCommitHistory } from '../utils/getCommitHistory';
import { sampleCommits } from '../utils/sampleCommits';
import { checkoutInWorktree } from '../utils/checkoutInWorktree';
import { HistoryPoint, HistoryPointResult, HistoryWalkResult } from '../types';

type RegressionRules = {
    thresholds: RegressionThresholds;
    severity: {
        'cross-boundary': 'info' | 'warning' | 'error';
        'deep-internal': 'info' | 'warning' | 'error';
        sibling: 'info' | 'warning' | 'error';
        internal: 'info' | 'warning' | 'error';
    };
};

type WalkHistoryArgs = {
    target: string;
    baselineRef: string;
    headRef?: string;
    sampleSize: number;
    rules: RegressionRules;
    scopes?: IRegressionScope[];
};

function evaluateDelta(args: {
    current: ScanResult;
    baseline: ScanResult;
    rules: RegressionRules;
    scopes?: IRegressionScope[];
}): HistoryPointResult {
    const { current, baseline, rules, scopes } = args;

    const delta = calculateDependencyDelta({ current, baseline });
    const findings = buildDependencyInsights(delta, rules, scopes);

    return { findings };
}

/**
 * Walks a sampled slice of the first-parent commit history and, for every
 * point, computes two kinds of regression findings against the *same*
 * scanned snapshots: `incremental` (vs. the previous sampled point, showing
 * risk introduced in that window) and `cumulative` (vs. the first sampled
 * point, showing total drift since the baseline). Both are cheap to compute
 * once a commit is scanned, so callers decide which one to surface rather
 * than this function picking a single strategy.
 */
export async function walkHistory(args: WalkHistoryArgs): Promise<HistoryWalkResult> {
    const { target, baselineRef, headRef, sampleSize, rules, scopes } = args;

    if (!validateGitRef(baselineRef)) {
        throw new Error(`Invalid git reference: ${baselineRef}`);
    }

    const fullHistory = getCommitHistory({ baselineRef, headRef });
    const sampled = sampleCommits(fullHistory, sampleSize);
    // getCommitHistory always includes the baseline commit, so sampled has at least one entry.
    const firstCommit = sampled[0] as (typeof sampled)[number];

    const worktree = createBaselineWorktree(firstCommit.sha);
    const points: HistoryPoint[] = [];

    try {
        let previousScan: ScanResult | null = null;
        let baselineScan: ScanResult | null = null;

        for (const commit of sampled) {
            checkoutInWorktree(worktree, commit.sha);

            const scan = await scanProject({
                scanRoot: resolveWorktreeTarget(worktree, target),
                projectRoot: worktree,
            });

            baselineScan ??= scan;

            const incremental = previousScan
                ? evaluateDelta({ current: scan, baseline: previousScan, rules, scopes })
                : null;

            const cumulative = previousScan
                ? evaluateDelta({ current: scan, baseline: baselineScan, rules, scopes })
                : null;

            points.push({
                commit,
                scannedFiles: scan.scannedFiles,
                modules: scan.graph.nodes.size,
                incremental,
                cumulative,
            });

            previousScan = scan;
        }
    } finally {
        removeBaselineWorktree(worktree);
    }

    return { points };
}
