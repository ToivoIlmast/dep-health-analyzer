#!/usr/bin/env node

import { scanProject } from './index.js';
import path from 'node:path';
import { calculateArchitectureMetrics } from './metrics/architectureMetrics.js';
import { printMetricsSummary } from './metrics/report.js';
import { findSCCs } from './metrics/findScc.js';
import { buildCytoscapeElements } from './visualization/adapters/buildCytoscapeElements.js';
import { generateHtml } from './visualization/generateHtml.js';

async function main() {
    const [, , command, target = '.'] = process.argv;

    if (command !== 'scan') {
        console.log(`
dep-health-analyzer

Usage:
  dep-health-analyzer scan <path>

Example:
  dep-health-analyzer scan ./src
`);
        process.exit(1);
    }

    const result = await scanProject(target);

    console.log(`dep-health-analyzer v0.2.0\n`);
    console.log(`Project: ${target}\n`);
    console.log(`Scanned files: ${result.scannedFiles}`);
    console.log(`Modules: ${result.graph.nodes.size}`);

    let edgesCount = 0;
    for (const deps of result.graph.edges.values()) {
        edgesCount += deps.size;
    }

    console.log(`Dependencies: ${edgesCount}`);
    console.log(`Cycles detected: ${result.cycles.length}`);
    const prettyLength: number[] = [];
    for (const cycle of result.cycles) {
        const pretty = cycle.map((file) => path.basename(file));
        prettyLength.push(pretty.length);
    }
    const largestScc = prettyLength.length > 0 ? Math.max(...prettyLength) : 0;
    console.log(`Largest SCC: ${largestScc} module(s)`);
    const instabilityMetrics = calculateArchitectureMetrics(result.graph);
    printMetricsSummary(instabilityMetrics);

    const sccs = findSCCs(result.graph);
    const elements = buildCytoscapeElements({
        graph: result.graph,
        metrics: instabilityMetrics,
        sccs,
    });
    generateHtml(elements);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
