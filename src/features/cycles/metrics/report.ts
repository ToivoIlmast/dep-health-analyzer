import path from 'node:path';
import chalk from 'chalk';
import { ModuleMetrics } from './types';

/* 
export function printMetrics(metrics: Map<string, ModuleMetrics>): void {
    console.log('\nArchitecture Metrics');
    console.log('(Internal project dependencies only)\n');

    console.log(
        'File'.padEnd(20),
        'Internal Ca'.padEnd(15),
        'Internal Ce'.padEnd(15),
        'Instability'
    );

    const sortedMetrics = [...metrics.entries()].sort(
        (a, b) => b[1].instability - a[1].instability
    );

    for (const [file, metric] of sortedMetrics) {
        let instabilityColor: string;

        if (metric.instability >= 0.8) {
            instabilityColor = chalk.red(metric.instability.toFixed(2));
        } else if (metric.instability >= 0.6) {
            instabilityColor = chalk.yellow(metric.instability.toFixed(2));
        } else {
            instabilityColor = chalk.green(metric.instability.toFixed(2));
        }

        console.log(
            path.basename(file).padEnd(20),
            String(metric.ca).padEnd(15),
            String(metric.ce).padEnd(15),
            instabilityColor
        );
    }
} 
*/

function formatInstability(value: number): string {
    if (value >= 0.8) {
        return chalk.red(value.toFixed(2));
    }

    if (value >= 0.6) {
        return chalk.yellow(value.toFixed(2));
    }

    return chalk.green(value.toFixed(2));
}

type printMetricsSummaryType = {
    metrics: Map<string, ModuleMetrics>;
    limit?: number;
};
export function printMetricsSummary(args: printMetricsSummaryType): void {
    const { metrics, limit = 3 } = args;
    const sorted = [...metrics.entries()].sort((a, b) => b[1].instability - a[1].instability);

    const unstable = sorted.slice(0, limit);

    const stable = [...sorted].reverse().slice(0, limit);

    console.log('\nMost unstable modules\n');

    for (const [file, metric] of unstable) {
        console.log(path.basename(file).padEnd(20), `I=${formatInstability(metric.instability)}`);
    }

    console.log('\nMost stable modules\n');

    for (const [file, metric] of stable) {
        console.log(path.basename(file).padEnd(20), `I=${formatInstability(metric.instability)}`);
    }
}
