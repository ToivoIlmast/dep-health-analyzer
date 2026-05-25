import { buildCytoscapeElements } from '@visualization/adapters';
import path from 'node:path';
import { generateHtml } from '@visualization/generateHtml';
import { scanProject } from '@core/scanProject';
import { detectCycles } from './detectCycles';
import { calculateArchitectureMetrics } from './metrics/architectureMetrics';
import { findSCCs } from './metrics/findScc';
import { printMetricsSummary } from './metrics/report';

export async function analyzeCycles(target: string): Promise<void> {
    const result = await scanProject(target);
    const cycles = detectCycles(result.graph);
    result.cycles = cycles;

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
