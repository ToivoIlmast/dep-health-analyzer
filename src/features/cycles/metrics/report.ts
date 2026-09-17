import path from 'node:path';
import chalk from 'chalk';
import { ModuleMetrics } from './types';

function formatInstability(value: number): string {
    if (value >= 0.8) {
        return chalk.red(value.toFixed(2));
    }

    if (value >= 0.6) {
        return chalk.yellow(value.toFixed(2));
    }

    return chalk.green(value.toFixed(2));
}

// F17: path.basename(file) alone collides for files sharing a name in
// different directories (e.g. src/foo/index.ts and src/bar/index.ts both
// display as "index.ts", making it impossible to tell which module is
// actually unstable). A path relative to the current working directory -
// the same convention analyzeCycles.ts's own unresolved-imports warning
// already uses - stays short for the common case while remaining unique.
function displayName(file: string): string {
    return path.relative(process.cwd(), file);
}

// F17: two independent comparators (not "sort by instability desc, then
// reverse for stable") so each list's tie-break reads the same way -
// alphabetical by displayed name, ascending - regardless of which list it
// is. Reversing a single sorted array would flip the tie-break direction
// for the "stable" list relative to "unstable", which is a confusing,
// accidental side effect of the reversal rather than a deliberate rule.
function compareByInstability(
    direction: 1 | -1
): (a: [string, ModuleMetrics], b: [string, ModuleMetrics]) => number {
    return (a, b) =>
        direction * (a[1].instability - b[1].instability) ||
        displayName(a[0]).localeCompare(displayName(b[0]));
}

type printMetricsSummaryType = {
    metrics: Map<string, ModuleMetrics>;
    limit?: number;
};
export function printMetricsSummary(args: printMetricsSummaryType): void {
    const { metrics, limit = 3 } = args;
    const entries = [...metrics.entries()];

    const unstable = [...entries].sort(compareByInstability(-1)).slice(0, limit);
    const stable = [...entries].sort(compareByInstability(1)).slice(0, limit);

    console.log('\nMost unstable modules\n');

    for (const [file, metric] of unstable) {
        console.log(displayName(file).padEnd(20), `I=${formatInstability(metric.instability)}`);
    }

    console.log('\nMost stable modules\n');

    for (const [file, metric] of stable) {
        console.log(displayName(file).padEnd(20), `I=${formatInstability(metric.instability)}`);
    }
}
