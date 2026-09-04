import { HISTORY_STRATEGIES, HistoryStrategyType } from '@shared/types';
import { HistoryPoint } from '../types';
import { getTrendInsights } from '../analyze/getTrendInsights';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const CLASSIFICATION_LABEL: Record<string, string> = {
    stabilizing: 'Stabilizing',
    worsening: 'Worsening',
    volatile: 'Volatile',
    stable: 'Stable',
};

const CLASSIFICATION_COLOR: Record<string, string> = {
    stabilizing: GREEN,
    stable: GREEN,
    volatile: YELLOW,
    worsening: RED,
};

function formatTrendLine(points: HistoryPoint[]): string {
    const { classification, worstWindow } = getTrendInsights(points);
    const label = CLASSIFICATION_LABEL[classification];
    const color = CLASSIFICATION_COLOR[classification];

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

    const hasRisk = points.some((point) => {
        const incrementalRisk = showIncremental && (countFor(point, 'incremental') ?? 0) > 0;
        const cumulativeRisk = showCumulative && (countFor(point, 'cumulative') ?? 0) > 0;
        return incrementalRisk || cumulativeRisk;
    });

    if (hasRisk) {
        console.log(`\n${RED}Architectural drift detected across the sampled history.${RESET}\n`);
    } else {
        console.log(`\n${GREEN}No architectural drift detected across the sampled history.${RESET}\n`);
    }
}
