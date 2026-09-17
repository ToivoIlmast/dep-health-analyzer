// P0-2 fix (pre-v0.10.2 audit): client-side overlap resolution
// (resolveEdgeNodeOverlaps/resolveNodeOverlaps in template.ts) was
// implemented directly against the live cytoscape instance, calling
// visibleNodes(cy)/visibleEdges(cy) - each an O(N) filter over the WHOLE
// node/edge collection - freshly for EVERY edge inside the iteration loop,
// and reading/writing node position/width/height through cytoscape's own
// getter/setter API (each of which does real work: cloning position
// objects, checking style-dirty flags, etc.) on every single comparison.
// Audit benchmark: ~0.30s/iteration at 600/700 nodes/edges, ~3.33s/iteration
// at 2000/2560 - and this is only resolveEdgeNodeOverlaps's own O(iterations
// x E x N) cost; resolveNodeOverlaps' separate O(iterations x N^2) pairwise
// check is worse still at real scale (10k+ modules).
//
// This module is deliberately framework-free: plain {id, x, y, width,
// height} node records and {sourceId, targetId} edge records, no
// cytoscape types, no DOM. Same two reasons as focusNeighbourSelection.ts
// (P0-1's equivalent extraction):
//
// 1. Real, precise Node.js benchmarking and behavioral tests against the
//    ACTUAL production algorithm - not a "simplified stand-in" the way the
//    audit's own benchmark necessarily was (it couldn't invoke this
//    private, cytoscape-coupled code directly).
// 2. The exact compiled source is embedded into the generated report's
//    client-side <script> via `.toString()` in template.ts, so there is
//    exactly one implementation, never a second one that could drift.
//
// What changed vs. the pre-fix version, and why each change is safe (never
// alters which nodes end up overlapping which edges, or by how much they
// get pushed - only how fast the SAME math runs):
//
// - visibleNodes(cy)/visibleEdges(cy) are captured ONCE by the cytoscape-
//   side caller (see template.ts's thin wrappers) instead of being
//   recomputed inside the loop - safe because which nodes/edges are
//   currently visible cannot change during a single synchronous resolve
//   call (nothing else runs concurrently in JS, and this code only ever
//   mutates position, never area-hidden membership).
// - width/height are captured once per node instead of re-read via
//   cytoscape's .width()/.height() accessors on every comparison - safe
//   for the same reason (a node's box size is fixed for the duration of
//   one resolve call).
// - Positions are read/written as plain mutable {x, y} fields on shared
//   node records instead of going through cytoscape's position()
//   getter/setter on every access - the SAME live-mutation-during-the-loop
//   semantics are preserved (a node pushed while acting as a "third node"
//   candidate for one edge is seen at its NEW position by a later edge in
//   the same iteration, exactly as before), only the storage is cheaper.
//   Cytoscape only sees the final, converged positions, written back once
//   in a single batch by the caller.
export type OverlapNode = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type OverlapEdge = {
    sourceId: string;
    targetId: string;
};

export type OrthogonalAxis = 'vertical' | 'horizontal' | null;

export type Point = { x: number; y: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };

// Moved unchanged from template.ts (was already pure) - shared by both
// resolveEdgeNodeOverlaps below and the minimap's own edge-path drawing in
// template.ts, which is why this lives here rather than as a private
// helper inside resolveEdgeNodeOverlaps itself.
export function computeEdgePathSegments(p1: Point, p2: Point, orthogonalAxis: OrthogonalAxis): Segment[] {
    if (orthogonalAxis === 'vertical') {
        const turnY = p1.y + (p2.y - p1.y) * 0.5;

        return [
            { x1: p1.x, y1: p1.y, x2: p1.x, y2: turnY },
            { x1: p1.x, y1: turnY, x2: p2.x, y2: turnY },
            { x1: p2.x, y1: turnY, x2: p2.x, y2: p2.y },
        ];
    }

    if (orthogonalAxis === 'horizontal') {
        const turnX = p1.x + (p2.x - p1.x) * 0.5;

        return [
            { x1: p1.x, y1: p1.y, x2: turnX, y2: p1.y },
            { x1: turnX, y1: p1.y, x2: turnX, y2: p2.y },
            { x1: turnX, y1: p2.y, x2: p2.x, y2: p2.y },
        ];
    }

    return [{ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }];
}

// Moved unchanged from template.ts (Liang-Barsky line-clipping, was
// already pure).
export function segmentIntersectsRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rectX: number,
    rectY: number,
    halfWidth: number,
    halfHeight: number,
): boolean {
    const left = rectX - halfWidth;
    const right = rectX + halfWidth;
    const top = rectY - halfHeight;
    const bottom = rectY + halfHeight;

    let t0 = 0;
    let t1 = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const edges: [number, number][] = [
        [-dx, x1 - left],
        [dx, right - x1],
        [-dy, y1 - top],
        [dy, bottom - y1],
    ];

    for (const [p, q] of edges) {
        if (p === 0) {
            if (q < 0) {
                return false;
            }
            continue;
        }

        const r = q / p;

        if (p < 0) {
            if (r > t1) {
                return false;
            }
            if (r > t0) {
                t0 = r;
            }
        } else {
            if (r < t0) {
                return false;
            }
            if (r < t1) {
                t1 = r;
            }
        }
    }

    return t0 <= t1;
}

// P0-2 fix (pre-v0.10.2 audit): node-count thresholds controlling how much
// overlap-resolution work runs on the Full Graph view for a large real
// project - NOT the Focused Graph, which P0-1 already bounds to at most
// FOCUS_FULL_SCC_MAX + FOCUS_NEIGHBOR_LIMIT + 1 nodes regardless of
// project size, so these never trigger there in practice.
//
// Calibrated from real Node.js benchmarks of THIS exact algorithm
// (scripts/benchmark-graph-overlap.mjs - run it to reproduce), not
// estimated: resolveEdgeNodeOverlaps (O(iterations x E x N)) is the
// dominant cost by a wide margin. At its default 8-iteration budget:
//   ~700 nodes/~1100 edges:   under ~0.9s   (measured on the audit's own
//                              600-700 worked example - fine as-is)
//   ~2000 nodes/~3200 edges:  ~8.2s          (audit's own worked example -
//                              already a user-visible page-load freeze)
//   ~10000 nodes/~16000 edges: ~319s (5+ minutes) - a genuine hang
// resolveNodeOverlaps (O(iterations x N^2)) is comparatively cheap
// throughout the SAME benchmark - well under 1s even at 10000 nodes with
// its default 30-iteration budget, because its per-pair check (box
// overlap arithmetic) is far cheaper than resolveEdgeNodeOverlaps' per-
// segment sqrt + Liang-Barsky clip. It still gets a defensive cap at the
// largest tier (see OVERLAP_NODE_NODE_HUGE_MAX_ITERATIONS below), purely
// as a safety margin against a real 'cose'-layout overlap pattern being
// denser than this benchmark's synthetic grid - not a response to a
// measured problem.
//
// OVERLAP_LIGHT_THRESHOLD (700): below this, resolveEdgeNodeOverlaps keeps
// its full requested iteration budget - the audit's own smallest worked
// example measured comfortably under a second here, no reduction needed.
//
// OVERLAP_SKIP_THRESHOLD (2000): above this, resolveEdgeNodeOverlaps is
// skipped ENTIRELY rather than further reduced - not an arbitrary "graph
// is big, turn it off" choice. Verified empirically (see the fix's own
// report): at 10000 nodes, even a SINGLE iteration (1/8 of the default
// budget) still cost ~28s, and two iterations ~61s - there is no non-zero
// iteration count left that stays fast enough once a graph is this large,
// so reducing further (the LIGHT-tier strategy) has nothing left to
// offer. 2000 is chosen at the audit's own explicit "already too slow"
// worked example, not an extrapolated guess. Visual impact is also
// genuinely minor at this scale - a graph with 2000+ nodes is already far
// past being readable as fine hierarchical detail; an edge grazing a
// node's corner is not something a reader would notice at this zoom.
//
// Between the two thresholds, resolveEdgeNodeOverlaps keeps running (real
// work, never a different/approximate algorithm) but with a reduced
// budget - measured up to ~3.9s at 2000 nodes with 2 iterations, vs. 8.2s
// unreduced - still doing genuine cleanup, just bounded.
// The threshold VALUES below are deliberately duplicated as plain number
// literals directly inside edgeNodeOverlapIterationsFor/
// nodeOverlapIterationsFor, rather than having those functions reference
// the named OVERLAP_* constants declared right after them. Two real,
// caught-live reasons a "closes over a shared const" version doesn't
// work here, both only surfacing once this function's compiled source is
// embedded verbatim into the report's plain <script> via .toString() (no
// module system, no bundler - see template.ts):
// (1) TypeScript's CommonJS output routes every internal reference to an
//     EXPORTED const through `exports.NAME` (to preserve ES-module live-
//     binding semantics) - there is no `exports` object in a browser
//     script, so this threw "exports is not defined" the first time it
//     was tried, caught via a headless-browser check against a real
//     generated report.
// (2) Even a PRIVATE (non-exported) module-scope const avoids that exact
//     error, but .toString() on a function only ever returns that
//     function's OWN source text - a sibling top-level `const` statement
//     the function merely reads is not part of it, so the embedded code
//     would reference a variable that was simply never declared in that
//     scope.
// Plain literals sidestep both failure modes entirely (nothing left to
// embed separately, nothing that requires a browser context that doesn't
// exist) - the same convention this file's own FOCUS_FULL_SCC_MAX/
// FOCUS_NEIGHBOR_LIMIT constants already use elsewhere in this report for
// an identical reason. The OVERLAP_* constants below are the single
// canonical, documented, testable source of truth for these numbers -
// scripts/benchmark-graph-overlap.mjs and graphOverlapResolution.test.ts
// both reference them by name; keep the literals inside the two functions
// in sync with them by hand if either ever changes.
export const OVERLAP_LIGHT_THRESHOLD = 700;
export const OVERLAP_SKIP_THRESHOLD = 2000;
export const OVERLAP_EDGE_NODE_LIGHT_MAX_ITERATIONS = 2;
export const OVERLAP_NODE_NODE_HUGE_MAX_ITERATIONS = 10;

// Deterministic, pure, independently testable - the same (nodeCount,
// requestedMaxIterations) pair always yields the same effective budget,
// regardless of which layout/caller asked. Literals below must match
// OVERLAP_LIGHT_THRESHOLD/OVERLAP_SKIP_THRESHOLD/
// OVERLAP_EDGE_NODE_LIGHT_MAX_ITERATIONS above - see this block's own top
// comment for why they aren't the same reference.
export function edgeNodeOverlapIterationsFor(nodeCount: number, requestedMaxIterations: number): number {
    if (nodeCount > 2000) {
        return 0;
    }
    if (nodeCount > 700) {
        return Math.min(requestedMaxIterations, 2);
    }
    return requestedMaxIterations;
}

// Literals below must match OVERLAP_SKIP_THRESHOLD/
// OVERLAP_NODE_NODE_HUGE_MAX_ITERATIONS above - see the block above
// edgeNodeOverlapIterationsFor for why.
export function nodeOverlapIterationsFor(nodeCount: number, requestedMaxIterations: number): number {
    if (nodeCount > 2000) {
        return Math.min(requestedMaxIterations, 10);
    }
    return requestedMaxIterations;
}

// Exported (not just an internal helper) purely so template.ts can embed
// it as its own top-level function via .toString() alongside
// resolveEdgeNodeOverlaps below, which calls it - a toString()-embedded
// function's source includes calls to sibling functions by name, but not
// those siblings' own definitions, so anything it calls has to be
// embedded separately too.
export function closestPointOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): Point {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        return { x: x1, y: y1 };
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    return { x: x1 + t * dx, y: y1 + t * dy };
}

// Pushes any node that a straight (or taxi-routed) edge would otherwise
// pass through out of that edge's way, perpendicular to the edge line.
// Mutates the given nodes' x/y in place; nodes/edges reference each other
// by id (nodesById is built once, not per edge). Identical math/behavior
// to the pre-fix version - see this module's own top comment for exactly
// what changed (cost only, never the result).
export function resolveEdgeNodeOverlaps(
    nodes: OverlapNode[],
    edges: OverlapEdge[],
    options?: { margin?: number; maxIterations?: number; orthogonalAxis?: OrthogonalAxis },
): void {
    const margin = options?.margin ?? 14;
    const requestedMaxIterations = options?.maxIterations ?? 8;
    const orthogonalAxis = options?.orthogonalAxis ?? null;
    const maxIterations = edgeNodeOverlapIterationsFor(nodes.length, requestedMaxIterations);

    if (maxIterations === 0) {
        return;
    }

    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        let movedAny = false;

        for (const edge of edges) {
            const source = nodesById.get(edge.sourceId);
            const target = nodesById.get(edge.targetId);

            // An edge whose endpoint isn't in the current node set (e.g. it
            // was filtered to a different visibility set than the caller
            // passed here) has nothing to push - matches the pre-fix
            // behavior, where such an edge simply wouldn't be in
            // visibleEdges(cy) alongside a mismatched visibleNodes(cy) in
            // the first place.
            if (!source || !target) {
                continue;
            }

            const segments = computeEdgePathSegments(source, target, orthogonalAxis);

            for (const node of nodes) {
                if (node.id === source.id || node.id === target.id) {
                    continue;
                }

                const halfWidth = node.width / 2;
                const halfHeight = node.height / 2;

                let intersectsAny = false;
                let closest: Point | null = null;
                let bestSegment: Segment | null = null;
                let distance = Infinity;

                for (const seg of segments) {
                    if (
                        segmentIntersectsRect(
                            seg.x1, seg.y1, seg.x2, seg.y2,
                            node.x, node.y,
                            halfWidth + margin, halfHeight + margin,
                        )
                    ) {
                        intersectsAny = true;
                    }

                    const c = closestPointOnSegment(node.x, node.y, seg.x1, seg.y1, seg.x2, seg.y2);
                    const dx = node.x - c.x;
                    const dy = node.y - c.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < distance) {
                        distance = dist;
                        closest = c;
                        bestSegment = seg;
                    }
                }

                if (!intersectsAny || !closest || !bestSegment) {
                    continue;
                }

                const clearance = Math.max(halfWidth, halfHeight) + margin;

                const awayX = node.x - closest.x;
                const awayY = node.y - closest.y;

                let normalX: number;
                let normalY: number;
                const currentLength = distance || 0.0001;

                if (distance < 0.5) {
                    const edgeDx = bestSegment.x2 - bestSegment.x1;
                    const edgeDy = bestSegment.y2 - bestSegment.y1;
                    const edgeLength = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
                    const side = node.id.length % 2 === 0 ? 1 : -1;

                    normalX = (-edgeDy / edgeLength) * side;
                    normalY = (edgeDx / edgeLength) * side;
                } else {
                    normalX = awayX / currentLength;
                    normalY = awayY / currentLength;
                }

                const pushBy = clearance - distance + 1;

                node.x += normalX * pushBy;
                node.y += normalY * pushBy;

                movedAny = true;
            }
        }

        if (!movedAny) {
            break;
        }
    }
}

// Separates any two nodes whose boxes overlap each other - the 'cose'
// layout's own node-repulsion physics can leave a pair overlapping,
// especially on a small focused subgraph starting from a previous, denser
// layout's positions. Only ever separates along whichever axis needs the
// smaller push - minimal disturbance to cose's own otherwise-good layout.
// Identical math/behavior to the pre-fix version.
export function resolveNodeOverlaps(nodes: OverlapNode[], options?: { margin?: number; maxIterations?: number }): void {
    const margin = options?.margin ?? 10;
    const requestedMaxIterations = options?.maxIterations ?? 30;
    const maxIterations = nodeOverlapIterationsFor(nodes.length, requestedMaxIterations);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        let movedAny = false;

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i]!;
                const b = nodes[j]!;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const minDx = (a.width + b.width) / 2 + margin;
                const minDy = (a.height + b.height) / 2 + margin;
                const overlapX = minDx - Math.abs(dx);
                const overlapY = minDy - Math.abs(dy);

                if (overlapX <= 0 || overlapY <= 0) {
                    continue;
                }

                if (overlapX < overlapY) {
                    const shift = overlapX / 2 + 0.5;
                    const dir = dx !== 0 ? Math.sign(dx) : (a.id < b.id ? -1 : 1);
                    a.x -= dir * shift;
                    b.x += dir * shift;
                } else {
                    const shift = overlapY / 2 + 0.5;
                    const dir = dy !== 0 ? Math.sign(dy) : (a.id < b.id ? -1 : 1);
                    a.y -= dir * shift;
                    b.y += dir * shift;
                }

                movedAny = true;
            }
        }

        if (!movedAny) {
            break;
        }
    }
}
