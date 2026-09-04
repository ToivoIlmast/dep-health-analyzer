import { HISTORY_STRATEGIES, HistoryStrategyType, IRegressionScope, MODES, ModeType } from '@shared/types';
import { validateGitRef } from '../../utils/validateGitRef';
import { shouldFail } from '../../utils/shouldFail';
import { DependencyInsight, RegressionThresholds } from '../../types';
import { compactModeReport } from '../ci/compactModeReport';
import { fullModeReport } from '../ci/fullModeReport';
import { htmlModeReport } from '../visualization';
import { HistoryPoint } from '../types';
import { walkHistory } from './walkHistory';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

type RegressionRules = {
    thresholds: RegressionThresholds;
    severity: {
        'cross-boundary': 'info' | 'warning' | 'error';
        'deep-internal': 'info' | 'warning' | 'error';
        sibling: 'info' | 'warning' | 'error';
        internal: 'info' | 'warning' | 'error';
    };
};

type AnalyzeHistoryType = {
    target: string;
    baselineRef: string;
    sampleSize: number;
    strategy: HistoryStrategyType;
    mode: ModeType;
    failOn: 'info' | 'warning' | 'error';
    rules: RegressionRules;
    scopes?: IRegressionScope[];
    isHtmlReportingEnabled: boolean;
    htmlReportOutputPath: string;
};

export type AnalyzeHistoryResult = {
    failed: boolean;
    points: HistoryPoint[];
};

function collectFindings(points: HistoryPoint[], strategy: HistoryStrategyType): DependencyInsight[] {
    const collected: DependencyInsight[] = [];

    for (const point of points) {
        if (strategy !== HISTORY_STRATEGIES.CUMULATIVE && point.incremental) {
            collected.push(...point.incremental.findings);
        }
        if (strategy !== HISTORY_STRATEGIES.INCREMENTAL && point.cumulative) {
            collected.push(...point.cumulative.findings);
        }
    }

    return collected;
}

export async function analyzeHistory(args: AnalyzeHistoryType): Promise<AnalyzeHistoryResult> {
    const {
        target,
        baselineRef,
        sampleSize,
        strategy,
        mode,
        failOn,
        rules,
        scopes,
        isHtmlReportingEnabled,
        htmlReportOutputPath,
    } = args;

    if (!validateGitRef(baselineRef)) {
        console.error(`Invalid git reference: ${baselineRef}`);
        process.exit(1);
    }

    console.log('Baseline:');
    console.log(`  ${baselineRef}`);
    console.log(`Sampling up to ${sampleSize} point(s), strategy: ${strategy}`);
    console.log();

    const { points } = await walkHistory({ target, baselineRef, sampleSize, rules, scopes });

    const failed = shouldFail({ findings: collectFindings(points, strategy), failOn });

    if (mode === MODES.HTML) {
        if (!isHtmlReportingEnabled) {
            console.warn(`${YELLOW}\nHTML reporting is disabled in config.\n${RESET}`);
            return { failed, points };
        }

        htmlModeReport({ points, strategy, target, baselineRef, outputPath: htmlReportOutputPath });
        return { failed, points };
    }

    const reporter = mode === MODES.FULL ? fullModeReport : compactModeReport;
    reporter({ points, strategy });

    return { failed, points };
}
