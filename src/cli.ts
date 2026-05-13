#!/usr/bin/env node

import { scanProject } from './index.js';
import path from 'node:path';
import { calculate } from './metrics/calculate.js';
import { printMetrics } from './metrics/report.js';

async function main() {
    const [, , command, target = '.'] = process.argv;

    if (command !== 'scan') {
        console.log(`
dep-health

Usage:
  dep-health scan <path>

Example:
  dep-health scan ./src
`);
        process.exit(1);
    }

    const result = await scanProject(target);

    console.log(`Scanned files: ${result.scannedFiles}`);
    console.log(`Nodes: ${result.graph.nodes.size}`);

    let edgesCount = 0;
    for (const deps of result.graph.edges.values()) {
        edgesCount += deps.size;
    }

    console.log(`Edges: ${edgesCount}`);

    console.log(`Cycles: ${result.cycles.length}`);
    for (const cycle of result.cycles) {
        const pretty = cycle.map((file) => path.basename(file));

        console.log(pretty.join(' -> '));
    }

    const instabilityMetrics = calculate(result.graph.edges);
    printMetrics(instabilityMetrics);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
