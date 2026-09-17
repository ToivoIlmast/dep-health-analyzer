// Minimal reproduction for a scalability limitation FOUND while verifying
// P0-2 (client-side overlap resolution), but NOT caused by and NOT fixed
// by P0-1 or P0-2: cytoscape's own dagre layout, run synchronously as part
// of the Graph view's initial render, does not complete in any reasonable
// time on a real ~10k-module graph.
//
// This script is read-only tooling - it does not touch, generate, or
// modify any report, fixture, or production source file (it only READS an
// already-generated report file, given as an argument). It extracts that
// report's own real `elements: { nodes, edges }` payload (the exact
// dependency graph the analyzer produced for that project) and feeds it
// into cytoscape's official headless mode (no DOM/canvas needed for
// layout computation) using the bundled libraries the report itself embeds
// (static/assets/{cytoscape,dagre,cytoscape-dagre}.min.js) - so the
// numbers below are the real analyzer's real graph, not a synthetic
// approximation.
//
// It times two phases separately so the bottleneck can't be confused with
// anything else:
//   1. cytoscape construction WITHOUT an initial layout
//   2. running the EXACT dagre layout config template.ts's own
//      `layouts.flowVertical` uses (the report's default, always-run-once-
//      at-page-load layout), via the same cy.layout({...}).run() call
//      onLayoutFinished() makes
//
// Usage:
//   npm run build && node dist/app/cli.js cycles --target <project> --mode html
//   node scripts/repro-dagre-layout-scale.mjs dep-health-reports/scc.html [timeoutMs]
import Module, { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

const reportPath = process.argv[2];
const timeoutMs = Number(process.argv[3]) || 0;

if (!reportPath) {
    console.error('Usage: node scripts/repro-dagre-layout-scale.mjs <path-to-report.html> [timeoutMs]');
    process.exit(1);
}

const html = fs.readFileSync(reportPath, 'utf8');

// Matches template.ts's own `elements: { nodes: ${safeJsonForScript(nodes)}, edges: ${safeJsonForScript(edges)} }`.
const nodesMatch = html.match(/elements:\s*\{\s*nodes:\s*(\[[\s\S]*?\]),\s*edges:/);
const edgesMatch = html.match(/edges:\s*(\[[\s\S]*?\])\s*,\s*\},[\s\S]*?style:\s*\[/);

if (!nodesMatch || !edgesMatch) {
    console.error('Could not find the embedded elements payload in ' + reportPath);
    process.exit(1);
}

const nodes = JSON.parse(nodesMatch[1]);
const edges = JSON.parse(edgesMatch[1]);
console.log(`Loaded real graph from ${reportPath}: ${nodes.length} nodes, ${edges.length} edges`);

// cytoscape-dagre's UMD wrapper does `require('dagre')` as if it were an
// installed npm package - it isn't here (dagre.min.js is a separate
// <script>-tag bundle in the real report, providing a global). Shim the
// module resolver so require resolves to the already-loaded bundle,
// mirroring how the two scripts cooperate via a shared global in the
// browser.
const dagre = require(path.join(ROOT, 'static/assets/dagre.min.js'));
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === 'dagre') {
        return 'dagre-shim';
    }
    return originalResolve.call(this, request, ...rest);
};
require.cache['dagre-shim'] = { id: 'dagre-shim', filename: 'dagre-shim', loaded: true, exports: dagre };

const cytoscape = require(path.join(ROOT, 'static/assets/cytoscape.min.js'));
const cytoscapeDagre = require(path.join(ROOT, 'static/assets/cytoscape-dagre.js'));
cytoscape.use(cytoscapeDagre);

function timeMs(fn) {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    return { ms: Number(end - start) / 1e6, result };
}

if (timeoutMs > 0) {
    setTimeout(() => {
        console.log(`>>> dagre layout.run() did NOT complete within ${timeoutMs} ms - killing.`);
        process.exit(2);
    }, timeoutMs).unref?.();
    // Keep the process alive for the timeout even though unref() would
    // otherwise let it exit early if the event loop is briefly empty.
    setInterval(() => {}, 1 << 30);
}

const construct = timeMs(() =>
    cytoscape({
        headless: true,
        styleEnabled: false,
        elements: {
            nodes: nodes.map((n) => ({ data: n.data })),
            edges: edges.map((e) => ({ data: e.data })),
        },
    }),
);
console.log(`cy construct (no layout): ${construct.ms.toFixed(1)} ms`);
const cy = construct.result;

console.log('starting dagre layout.run() (exact flowVertical config)...');
const layoutRun = timeMs(() => {
    const layout = cy.layout({
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 100,
        rankSep: 400,
        edgeSep: 40,
        padding: 60,
        spacingFactor: 1,
        fit: false,
        nodeDimensionsIncludeLabels: true,
    });
    layout.run();
});
console.log(`dagre layout.run(): ${layoutRun.ms.toFixed(1)} ms`);
process.exit(0);
