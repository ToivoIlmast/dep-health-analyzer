import { HISTORY_STRATEGIES, HistoryStrategyType } from '@shared/types';
import { aggregation } from '../../ci/reporting/defaultModeReport/aggregation';
import { printFindings } from '../../ci/reporting/defaultModeReport/printFindings';
import { getTrendInsights } from '../analyze/getTrendInsights';
import { HistoryPoint } from '../types';

const CLASSIFICATION_LABEL: Record<string, string> = {
    stabilizing: 'Stabilizing',
    worsening: 'Worsening',
    volatile: 'Volatile',
    stable: 'Stable',
};

function printTrendSummary(points: HistoryPoint[]): void {
    const { classification, spikes, worstWindow } = getTrendInsights(points);

    console.log('Trend Summary\n');
    console.log(`  Classification: ${CLASSIFICATION_LABEL[classification]}`);

    if (worstWindow) {
        const sha = worstWindow.commit.sha.slice(0, 7);
        const date = worstWindow.commit.date.slice(0, 10);
        console.log(`  Highest risk window: ${worstWindow.value} finding(s) at ${sha} (${date})`);
    }

    if (spikes.length > 0) {
        console.log(`  Spikes (${spikes.length}):`);
        for (const spike of spikes) {
            const sha = spike.commit.sha.slice(0, 7);
            const date = spike.commit.date.slice(0, 10);
            console.log(`    - ${sha} (${date}): ${spike.value} finding(s)`);
        }
    } else {
        console.log('  No spikes detected.');
    }

    console.log('');
}

export function fullModeReport(args: { points: HistoryPoint[]; strategy: HistoryStrategyType }): void {
    const { points, strategy } = args;
    const showIncremental = strategy !== HISTORY_STRATEGIES.CUMULATIVE;
    const showCumulative = strategy !== HISTORY_STRATEGIES.INCREMENTAL;

    console.log('\nArchitecture History (full)\n');

    printTrendSummary(points);

    for (const point of points) {
        console.log(`--- ${point.commit.sha.slice(0, 7)}  ${point.commit.date}  ${point.commit.title}`);
        console.log(`Scanned files: ${point.scannedFiles}`);
        console.log(`Modules: ${point.modules}`);

        if (showIncremental) {
            console.log('\nIncremental (vs. previous point):');
            if (point.incremental) {
                printFindings(aggregation({ delta: point.incremental.findings }));
            } else {
                console.log('  (baseline point, nothing precedes it)\n');
            }
        }

        if (showCumulative) {
            console.log('Cumulative (vs. first point):');
            if (point.cumulative) {
                printFindings(aggregation({ delta: point.cumulative.findings }));
            } else {
                console.log('  (this IS the baseline point)\n');
            }
        }
    }
}
