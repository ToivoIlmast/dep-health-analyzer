import path from 'node:path';
import chalk from 'chalk';
import { ModuleMetrics } from './calculate';

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
