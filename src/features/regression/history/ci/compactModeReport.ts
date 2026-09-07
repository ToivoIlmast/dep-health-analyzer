import { HISTORY_STRATEGIES, HistoryStrategyType } from '@shared/types';
import { HistoryPoint } from '../types';
import { getTrendInsights, TrendClassification } from '../analyze/getTrendInsights';
import { getTrendLabel } from '../analyze/describeTrend';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

/**
 * Visual highlight means "this changed / is worth a look", not "this is
 * good or bad" - a directional change (up, down, or fluctuating) gets the
 * same neutral attention color; "no clear trend" gets none, since there's
 * nothing to draw the eye to.
 */
const NOTICE_COLOR: Record<TrendClassification, string> = {
    worsening: YELLOW,
    stabilizing: YELLOW,
    volatile: YELLOW,
    stable: '',
};

function formatTrendLine(points: HistoryPoint[]): string {
    const { classification, worstWindow } = getTrendInsights(points);
    const label = getTrendLabel(classification);
    const color = NOTICE_COLOR[classification];

    if (!worstWindow) {
        return `${color}Trend: ${label}${RESET}`;
    }

    const sha = worstWindow.commit.sha.slice(0, 7);
    const date = worstWindow.commit.date.slice(0, 10);
    return `${color}Trend: ${label} (highest: ${worstWindow.value} finding(s) at ${sha} on ${date})${RESET}`;
}

function countFor(point: HistoryPoint, key: 'incremental' | 'cumulative'): number | null {
    const result = point[key];
    return result ? result.findings.length : null;
}

export function compactModeReport(args: { points: HistoryPoint[]; strategy: HistoryStrategyType }): void {
    const { points, strategy } = args;
    const showIncremental = strategy !== HISTORY_STRATEGIES.CUMULATIVE;
    const showCumulative = strategy !== HISTORY_STRATEGIES.INCREMENTAL;

    console.log('\nArchitecture History Summary\n');

    for (const point of points) {
        const sha = point.commit.sha.slice(0, 7);
        const date = point.commit.date.slice(0, 10);
        const parts = [`${sha}  ${date}  files: ${point.scannedFiles}`];

        if (showIncremental) {
            const count = countFor(point, 'incremental');
            parts.push(`incremental: ${count === null ? '-' : count}`);
        }

        if (showCumulative) {
            const count = countFor(point, 'cumulative');
            parts.push(`cumulative: ${count === null ? '-' : count}`);
        }

        console.log('  ' + parts.join('  |  '));
    }

    console.log(`\n${formatTrendLine(points)}`);

    const hasFindings = points.some((point) => {
        const hasIncrementalFindings = showIncremental && (countFor(point, 'incremental') ?? 0) > 0;
        const hasCumulativeFindings = showCumulative && (countFor(point, 'cumulative') ?? 0) > 0;
        return hasIncrementalFindings || hasCumulativeFindings;
    });

    if (hasFindings) {
        console.log(`\n${YELLOW}New findings were introduced across the sampled history.${RESET}\n`);
    } else {
        console.log(`\nNo new findings were introduced across the sampled history.\n`);
    }
}
