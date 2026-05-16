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
dep-health

Usage:
  dep-health scan <path>

Example:
  dep-health scan ./src
`);
        process.exit(1);
    }

    const result = await scanProject(target);

    console.log(`dep-health v0.2.0\n`);
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
        // console.log(pretty.join(' -> '));
        prettyLength.push(pretty.length);
    }
    console.log(`Largest SCC: ${Math.max(...prettyLength)} module(s)`);
    const instabilityMetrics = calculateArchitectureMetrics(result.graph);
    printMetricsSummary(instabilityMetrics);

    /* const graph1 = new Map<string, Set<string>>([
        ['A', new Set(['B'])],
        ['B', new Set(['C'])],
        ['C', new Set(['A', 'D'])],

        ['D', new Set(['E'])],
        ['E', new Set(['F'])],
        ['F', new Set(['D'])],

        ['G', new Set(['H'])],
        ['H', new Set([])],
    ]); */

    // console.log('Graph', result.graph.edges);
    const sccs = findSCCs(result.graph);
    // console.log('Strongly Connected Component (SCCs):', sccs);
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
