// P0-2 benchmark: measures the REAL, production resolveEdgeNodeOverlaps/
// resolveNodeOverlaps algorithms (src/features/cycles/visualization/
// graphOverlapResolution.ts, compiled to dist/) directly in Node - no
// cytoscape/DOM overhead, no "simplified stand-in" the way the original
// audit's own benchmark necessarily was, since this calls the exact same
// code the generated HTML report embeds via .toString().
//
// Synthetic inputs are deliberately adversarial (nodes packed into a tight
// grid, well inside each other's clearance radius) so the algorithm
// actually does close to its full iteration budget of real work every
// time - a fair worst-case measurement, not a lucky "already resolved,
// converged after iteration 1" case.
//
// Run: node scripts/benchmark-graph-overlap.mjs (after `npm run build`).
import { resolveEdgeNodeOverlaps, resolveNodeOverlaps } from '../dist/features/cycles/visualization/graphOverlapResolution.js';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 50;
const GRID_GAP = 40; // deliberately smaller than NODE_WIDTH/HEIGHT + margin, guarantees real overlaps

function buildGraph(nodeCount) {
    const cols = Math.ceil(Math.sqrt(nodeCount));
    const nodes = [];

    for (let i = 0; i < nodeCount; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        nodes.push({
            id: `n${i}`,
            x: col * (NODE_WIDTH + GRID_GAP),
            y: row * (NODE_HEIGHT + GRID_GAP),
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
        });
    }

    // A realistic-ish edge count/shape: one long chain (every node to the
    // next) plus a fan-out every 5th node to 3 later nodes - lands close to
    // the ~1.0-1.3x node-count edge ratio the real corpus fixtures have
    // (cycles-large: 602 modules / ~602 deps; scale-medium, stress-10k
    // similar order).
    const edges = [];
    for (let i = 0; i < nodeCount - 1; i++) {
        edges.push({ sourceId: `n${i}`, targetId: `n${i + 1}` });
    }
    for (let i = 0; i < nodeCount; i += 5) {
        for (let k = 1; k <= 3; k++) {
            const target = i + k * 7;
            if (target < nodeCount) {
                edges.push({ sourceId: `n${i}`, targetId: `n${target}` });
            }
        }
    }

    return { nodes, edges };
}

function cloneNodes(nodes) {
    return nodes.map((n) => ({ ...n }));
}

function timeMs(fn) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6;
}

const SCALES = [115, 650, 2000, 10000];

console.log('Node   Edges   resolveEdgeNodeOverlaps(default maxIter)   resolveNodeOverlaps(default maxIter)');
console.log('-----  ------  -----------------------------------------  ------------------------------------');

for (const nodeCount of SCALES) {
    const { nodes, edges } = buildGraph(nodeCount);

    const edgeNodeInput = cloneNodes(nodes);
    const edgeNodeMs = timeMs(() => {
        resolveEdgeNodeOverlaps(edgeNodeInput, edges, { maxIterations: 8 });
    });

    // resolveNodeOverlaps is only ever run for the 'cose' layout, which
    // P0-1 already bounds to a small focused subgraph in the one place a
    // user can't choose the node count themselves - but it's ALSO directly
    // selectable for the Full Graph via the Layout dropdown, so it's
    // benchmarked at full scale here regardless.
    const nodeOverlapInput = cloneNodes(nodes);
    const nodeOverlapMs = timeMs(() => {
        resolveNodeOverlaps(nodeOverlapInput, { maxIterations: 30 });
    });

    console.log(
        `${String(nodeCount).padEnd(5)}  ${String(edges.length).padEnd(6)}  ${edgeNodeMs.toFixed(1).padStart(8)} ms` +
            `${' '.repeat(35)}${nodeOverlapMs.toFixed(1).padStart(8)} ms`,
    );
}
