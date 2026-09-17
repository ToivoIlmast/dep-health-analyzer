import {
    OVERLAP_LIGHT_THRESHOLD,
    OVERLAP_SKIP_THRESHOLD,
    OverlapEdge,
    OverlapNode,
    computeEdgePathSegments,
    edgeNodeOverlapIterationsFor,
    nodeOverlapIterationsFor,
    resolveEdgeNodeOverlaps,
    resolveNodeOverlaps,
    segmentIntersectsRect,
} from './graphOverlapResolution';

// Real behavioral tests, executed directly against the actual algorithm -
// the same code embedded verbatim into the generated report via
// .toString() (see template.ts). No flaky wall-clock assertions
// ("must complete in Nms") - see scripts/benchmark-graph-overlap.mjs for
// the actual timing measurements (a dedicated benchmark artifact, not a
// Jest test). These tests instead assert deterministic BEHAVIOR: does the
// math still push nodes correctly, and do the node-count thresholds
// actually bound the work performed.

function node(id: string, x: number, y: number, width = 100, height = 40): OverlapNode {
    return { id, x, y, width, height };
}

describe('edgeNodeOverlapIterationsFor / nodeOverlapIterationsFor (P0-2 thresholds)', () => {
    it('below OVERLAP_LIGHT_THRESHOLD, keeps the caller-requested iteration budget unchanged', () => {
        expect(edgeNodeOverlapIterationsFor(OVERLAP_LIGHT_THRESHOLD, 8)).toBe(8);
        expect(edgeNodeOverlapIterationsFor(1, 20)).toBe(20);
    });

    it('between the two thresholds, caps the edge-node budget at OVERLAP_EDGE_NODE_LIGHT_MAX_ITERATIONS regardless of what was requested', () => {
        expect(edgeNodeOverlapIterationsFor(OVERLAP_LIGHT_THRESHOLD + 1, 8)).toBe(2);
        expect(edgeNodeOverlapIterationsFor(OVERLAP_SKIP_THRESHOLD, 20)).toBe(2);
        // A caller requesting FEWER than the light cap keeps its own smaller request.
        expect(edgeNodeOverlapIterationsFor(OVERLAP_LIGHT_THRESHOLD + 1, 1)).toBe(1);
    });

    it('above OVERLAP_SKIP_THRESHOLD, returns exactly 0 (skip entirely) regardless of the requested budget', () => {
        expect(edgeNodeOverlapIterationsFor(OVERLAP_SKIP_THRESHOLD + 1, 8)).toBe(0);
        expect(edgeNodeOverlapIterationsFor(50000, 1)).toBe(0);
    });

    it('nodeOverlapIterationsFor keeps the full budget below/at OVERLAP_SKIP_THRESHOLD - resolveNodeOverlaps stayed cheap at every measured scale up to that point', () => {
        expect(nodeOverlapIterationsFor(OVERLAP_SKIP_THRESHOLD, 30)).toBe(30);
        expect(nodeOverlapIterationsFor(1, 30)).toBe(30);
    });

    it('nodeOverlapIterationsFor caps (never skips to 0) above OVERLAP_SKIP_THRESHOLD - a defensive margin, not a response to a measured problem', () => {
        expect(nodeOverlapIterationsFor(OVERLAP_SKIP_THRESHOLD + 1, 30)).toBe(10);
        expect(nodeOverlapIterationsFor(50000, 30)).toBe(10);
        expect(nodeOverlapIterationsFor(OVERLAP_SKIP_THRESHOLD + 1, 5)).toBe(5);
    });

    it('is deterministic: identical inputs always produce the identical output', () => {
        for (let i = 0; i < 5; i++) {
            expect(edgeNodeOverlapIterationsFor(1500, 8)).toBe(2);
            expect(nodeOverlapIterationsFor(5000, 30)).toBe(10);
        }
    });
});

describe('resolveEdgeNodeOverlaps (P0-2: correctness preserved after extraction/optimization)', () => {
    it('pushes a node that a straight edge cuts through out of the way, until it no longer intersects', () => {
        const nodes: OverlapNode[] = [
            node('A', 0, 0),
            node('B', 400, 0),
            node('blocker', 200, 0), // sits exactly on the A->B line
        ];
        const edges: OverlapEdge[] = [{ sourceId: 'A', targetId: 'B' }];

        resolveEdgeNodeOverlaps(nodes, edges, { maxIterations: 8 });

        const blocker = nodes.find((n) => n.id === 'blocker')!;
        const segments = computeEdgePathSegments({ x: 0, y: 0 }, { x: 400, y: 0 }, null);
        const stillIntersects = segments.some((seg) =>
            segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, blocker.x, blocker.y, blocker.width / 2 + 14, blocker.height / 2 + 14),
        );
        expect(stillIntersects).toBe(false);
    });

    it('leaves nodes untouched when nothing overlaps an edge', () => {
        const nodes: OverlapNode[] = [node('A', 0, 0), node('B', 400, 0), node('far', 200, 500)];
        const edges: OverlapEdge[] = [{ sourceId: 'A', targetId: 'B' }];
        const before = nodes.map((n) => ({ ...n }));

        resolveEdgeNodeOverlaps(nodes, edges, { maxIterations: 8 });

        expect(nodes).toEqual(before);
    });

    it('never moves an edge\'s own source/target node, even if a differently-shaped check would flag it', () => {
        const nodes: OverlapNode[] = [node('A', 0, 0), node('B', 0, 0)]; // degenerate zero-length edge
        const edges: OverlapEdge[] = [{ sourceId: 'A', targetId: 'B' }];
        const before = nodes.map((n) => ({ ...n }));

        resolveEdgeNodeOverlaps(nodes, edges, { maxIterations: 8 });

        expect(nodes).toEqual(before);
    });

    it('skips an edge whose endpoint is missing from the given node set instead of throwing', () => {
        const nodes: OverlapNode[] = [node('A', 0, 0)];
        const edges: OverlapEdge[] = [{ sourceId: 'A', targetId: 'ghost' }];

        expect(() => resolveEdgeNodeOverlaps(nodes, edges, { maxIterations: 8 })).not.toThrow();
    });

    it('P0-2 complexity guard: above OVERLAP_SKIP_THRESHOLD nodes, does no work at all - positions are returned completely unchanged', () => {
        const nodeCount = 2500;
        const nodes: OverlapNode[] = [];
        for (let i = 0; i < nodeCount; i++) {
            // Deliberately overlapping positions (all nodes stacked at the
            // same point) - if the skip threshold weren't respected, this
            // would be the worst possible case for real work to happen.
            nodes.push(node(`n${i}`, 0, 0));
        }
        const edges: OverlapEdge[] = [];
        for (let i = 0; i < nodeCount - 1; i++) {
            edges.push({ sourceId: `n${i}`, targetId: `n${i + 1}` });
        }
        const before = nodes.map((n) => ({ ...n }));

        resolveEdgeNodeOverlaps(nodes, edges, { maxIterations: 8 });

        expect(nodes).toEqual(before);
    });

    it('deterministic tie-break: a node sitting exactly on the edge line is pushed to a side chosen by its own id, not by call order', () => {
        const nodesRun1: OverlapNode[] = [node('A', 0, 0), node('B', 400, 0), node('mid', 200, 0)];
        const nodesRun2: OverlapNode[] = [node('A', 0, 0), node('B', 400, 0), node('mid', 200, 0)];
        const edges: OverlapEdge[] = [{ sourceId: 'A', targetId: 'B' }];

        resolveEdgeNodeOverlaps(nodesRun1, edges, { maxIterations: 8 });
        resolveEdgeNodeOverlaps(nodesRun2, edges, { maxIterations: 8 });

        expect(nodesRun1).toEqual(nodesRun2);
    });
});

describe('resolveNodeOverlaps (P0-2: correctness preserved after extraction/optimization)', () => {
    it('separates two overlapping nodes until their boxes no longer overlap', () => {
        const nodes: OverlapNode[] = [node('A', 0, 0, 100, 40), node('B', 10, 0, 100, 40)];

        resolveNodeOverlaps(nodes, { maxIterations: 30 });

        const a = nodes[0]!;
        const b = nodes[1]!;
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        const minDx = (a.width + b.width) / 2 + 10;
        const minDy = (a.height + b.height) / 2 + 10;
        expect(dx >= minDx || dy >= minDy).toBe(true);
    });

    it('leaves already-separated nodes untouched', () => {
        const nodes: OverlapNode[] = [node('A', 0, 0), node('B', 1000, 1000)];
        const before = nodes.map((n) => ({ ...n }));

        resolveNodeOverlaps(nodes, { maxIterations: 30 });

        expect(nodes).toEqual(before);
    });

    it('deterministic tie-break for two nodes on the exact same point: direction is chosen by id comparison, not object/array order', () => {
        const nodesRun1: OverlapNode[] = [node('aaa', 0, 0), node('zzz', 0, 0)];
        const nodesRun2: OverlapNode[] = [node('zzz', 0, 0), node('aaa', 0, 0)];

        resolveNodeOverlaps(nodesRun1, { maxIterations: 30 });
        resolveNodeOverlaps(nodesRun2, { maxIterations: 30 });

        const aaaFrom1 = nodesRun1.find((n) => n.id === 'aaa')!;
        const aaaFrom2 = nodesRun2.find((n) => n.id === 'aaa')!;
        expect(aaaFrom1.x).toBeCloseTo(aaaFrom2.x);
        expect(aaaFrom1.y).toBeCloseTo(aaaFrom2.y);
    });

    it('P0-2: still runs (capped, not skipped) above OVERLAP_SKIP_THRESHOLD - unlike resolveEdgeNodeOverlaps, it stayed cheap at every measured scale, so overlapping nodes are still genuinely separated, not left broken-looking', () => {
        const nodes: OverlapNode[] = [node('A', 0, 0, 100, 40), node('B', 5, 0, 100, 40)];
        for (let i = 0; i < 3000; i++) {
            nodes.push(node(`filler${i}`, 10000 + i * 200, 10000)); // far away, never interacts
        }

        resolveNodeOverlaps(nodes, { maxIterations: 30 });

        const a = nodes.find((n) => n.id === 'A')!;
        const b = nodes.find((n) => n.id === 'B')!;
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        const minDx = (a.width + b.width) / 2 + 10;
        const minDy = (a.height + b.height) / 2 + 10;
        expect(dx >= minDx || dy >= minDy).toBe(true);
    });
});
