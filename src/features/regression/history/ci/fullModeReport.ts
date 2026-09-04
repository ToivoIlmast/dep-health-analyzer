import { HISTORY_STRATEGIES, HistoryStrategyType } from '@shared/types';
import { aggregation } from '../../ci/reporting/defaultModeReport/aggregation';
import { printFindings } from '../../ci/reporting/defaultModeReport/printFindings';
import { HistoryPoint } from '../types';

export function fullModeReport(args: { points: HistoryPoint[]; strategy: HistoryStrategyType }): void {
    const { points, strategy } = args;
    const showIncremental = strategy !== HISTORY_STRATEGIES.CUMULATIVE;
    const showCumulative = strategy !== HISTORY_STRATEGIES.INCREMENTAL;

    console.log('\nArchitecture History (full)\n');

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
