import { CytoscapeEdge, CytoscapeNode } from '../adapters';
import { safeJsonForScript } from '@shared/safeJsonForScript';
import { styles } from './styles';

type BuildHtmlTemplate = {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
};

export function buildHtmlTemplate(args: BuildHtmlTemplate) {
    const { nodes, edges } = args;
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8" />
        <title>dep-health-analyzer graph</title>
    
        <script src="./assets/cytoscape.min.js"></script>
        <script src="./assets/dagre.min.js"></script>
        <script src="./assets/cytoscape-dagre.js"></script>
    
        <style>
            ${styles}
        </style>
    </head>
    
    <body>
        <div id="cy"></div>
        <div id="tooltip"></div>

        <div id="toolbar">
            <label>
                Layout:
                <select id="layout-select">
                    <option value="dagreLR">Dagre LR</option>
                    <option value="dagreTB">Dagre TB</option>
                    <option value="dagreLRClean">Dagre LR (straight edges, no overlap)</option>
                    <option value="flowTB">Flow / Hierarchical (Top to Bottom)</option>
                    <option value="flowOrthogonal" selected>Hierarchical (Orthogonal, Top to Bottom)</option>
                    <option value="flowOrthogonalLR">Hierarchical (Orthogonal, Left to Right)</option>
                    <option value="flowVertical">Hierarchical (Orthogonal, Vertical Flow)</option>
                    <option value="breadthfirst">Breadth First</option>
                    <option value="cose">Force Directed</option>
                </select>
            </label>

            <button id="fit-btn">
                Fit Graph
            </button>
        </div>

        <div id="edge-clarity-note">
            Edges route as right-angle connectors, spread out to stay clear of other modules.
        </div>

        <!-- Experimental (branch: experiment/cycle-map-v2, HUD layer). A
             persistent bottom panel, not part of the graph canvas - see
             #hud in styles.ts. Three sections: the module-type legend
             (moved here from the old top-left floating panel, same
             swatches/checkbox, same behavior), the currently-selected
             module's info (new - previously only available via hover
             tooltip, which stays as-is for quick hover peeks), and the
             minimap (moved here from its own floating box, same canvas/
             drawing code, just relocated and resized to fit this panel). -->
        <div id="hud">
            <div id="hud-legend">
                <div class="hud-section-title" title="Best-effort, derived from each module's file path">Module type</div>
                <div class="hud-legend-grid">
                    <div><span class="legend-swatch" style="background: #3b82f6;"></span>Entry / Root</div>
                    <div><span class="legend-swatch" style="background: #22c55e;"></span>Core module</div>
                    <div><span class="legend-swatch" style="background: #a855f7;"></span>Feature module</div>
                    <div><span class="legend-swatch" style="background: #9ca3af;"></span>Utility module</div>
                    <div><span class="legend-swatch" style="background: #f97316;"></span>Script / Tooling</div>
                </div>
                <label class="hud-highlight-toggle">
                    <input type="checkbox" id="highlight-toggle" checked />
                    Highlight connected modules
                </label>
            </div>

            <div id="hud-selected">
                <div class="hud-section-title">Selected module</div>
                <div id="hud-selected-content"><span class="hud-empty">No module selected</span></div>
            </div>

            <div id="hud-minimap">
                <div class="hud-section-title">Minimap</div>
                <canvas id="minimap-canvas" width="200" height="100"></canvas>
            </div>
        </div>

        <script>
            // Node labels/ids come from file paths, which could in principle
            // contain HTML if a file were named that way - escape before
            // using innerHTML below, since the tooltip is built from a
            // template string, not from text-only DOM APIs.
            function escapeHtml(value) {
                const div = document.createElement('div');
                div.textContent = value;
                return div.innerHTML;
            }

            const layouts = {
                dagreLR: {
                    name: 'dagre',
                    rankDir: 'LR',
                    nodeSep: 60,
                    rankSep: 140,
                    edgeSep: 30,
                    padding: 40,
                    spacingFactor: 1.3,
                    fit: false,
                    nodeDimensionsIncludeLabels: true,
                },
            
                dagreTB: {
                    name: 'dagre',
                    rankDir: 'TB',
                    nodeSep: 60,
                    rankSep: 140,
                    edgeSep: 30,
                    padding: 40,
                    spacingFactor: 1.3,
                    fit: false,
                    nodeDimensionsIncludeLabels: true,
                },

                // Experimental (branch: experiment/cycle-map-v2). cytoscape-dagre
                // only computes real-node positions - it never exposes dagre's
                // internal per-rank dummy-node bend points to cytoscape, so with
                // 'curve-style: straight' every edge is a naive center-to-center
                // line with zero awareness of what else sits between the two
                // endpoints. A long edge spanning several ranks can - and on real
                // dependency graphs, does - cut straight through an unrelated
                // node sitting in an intermediate rank. Since there is no bend
                // routing available to fall back on, and orthogonal/'taxi' edges
                // are explicitly unwanted, this widens the layout well past
                // dagreLR's own spacing (favoring a taller, roomier result over a
                // compact one) and then runs resolveEdgeNodeOverlaps() below to
                // nudge any node a straight edge would otherwise pass through.
                dagreLRClean: {
                    name: 'dagre',
                    rankDir: 'LR',
                    nodeSep: 110,
                    rankSep: 220,
                    edgeSep: 40,
                    padding: 60,
                    spacingFactor: 1,
                    fit: false,
                    nodeDimensionsIncludeLabels: true,
                },

                breadthfirst: {
                    name: 'breadthfirst',
                    directed: true,
                    fit: false,
                    padding: 40,
                },

                cose: {
                    name: 'cose',
                    animate: true,
                    fit: false,
                    padding: 40,
                },

                // Experimental (branch: experiment/cycle-map-v2). A flowchart
                // reading of the same dagre engine already used above, not a
                // new layout algorithm: rankDir 'TB' turns dependency depth
                // into a top-to-bottom visual hierarchy (A depends on B, C ->
                // B and C draw below A), which reads as "flow" the way LR
                // reads as "timeline". Left at dagre's own defaults for
                // ranker/align/acyclicer - 'network-simplex' ranking plus
                // averaging all four corner alignments is already dagre's
                // own recommended crossing-minimizing configuration, and
                // overriding it produced no measured improvement (see the
                // delivery notes for this change) at the cost of a skewed,
                // less balanced layout. Spacing is widened the same way
                // dagreLRClean widens LR spacing, for the same reason: more
                // room between nodes/ranks up front means
                // resolveEdgeNodeOverlaps() below has to push things around
                // less to keep every straight edge clear of unrelated nodes.
                flowTB: {
                    name: 'dagre',
                    rankDir: 'TB',
                    nodeSep: 90,
                    rankSep: 170,
                    edgeSep: 40,
                    padding: 60,
                    spacingFactor: 1,
                    fit: false,
                    nodeDimensionsIncludeLabels: true,
                },

                // Experimental (branch: experiment/cycle-map-v2). Same TB
                // ranking as flowTB - only the edge curve-style differs (see
                // the '.orthogonal-edge-vertical' style rule and
                // ORTHOGONAL_LAYOUT_AXES below), toggled to cytoscape core's
                // native 'taxi' style
                // for this layout only. rankSep is wider than flowTB's: a
                // taxi edge's horizontal jog sits entirely within the gap
                // between two ranks, so that gap needs to comfortably fit
                // the jog clear of whatever sits at the very top/bottom
                // edge of the nodes on either side of it, not just clear
                // the node bodies themselves.
                flowOrthogonal: {
                    name: 'dagre',
                    rankDir: 'TB',
                    nodeSep: 100,
                    rankSep: 200,
                    edgeSep: 40,
                    padding: 60,
                    spacingFactor: 1,
                    fit: false,
                    nodeDimensionsIncludeLabels: true,
                },

                // Experimental (branch: experiment/cycle-map-v2). The LR
                // counterpart of flowOrthogonal above - same idea, rotated
                // 90 degrees. rankSep (here, the horizontal gap between
                // columns) is wider still: nodes are now label-width
                // rectangles rather than small circles, so the gap between
                // columns needs to clear whole boxes (often 100px+ wide)
                // plus room for the taxi path's vertical jog, not just a
                // small fixed node diameter. nodeSep (vertical gap within a
                // column) can stay closer to flowOrthogonal's TB nodeSep
                // value since box height is driven by two lines of text,
                // not by column direction.
                flowOrthogonalLR: {
                    name: 'dagre',
                    rankDir: 'LR',
                    nodeSep: 70,
                    rankSep: 220,
                    edgeSep: 40,
                    padding: 60,
                    spacingFactor: 1,
                    fit: false,
                    nodeDimensionsIncludeLabels: true,
                },

                // Experimental (branch: experiment/cycle-map-v2). A second,
                // deliberately different take on the TB orthogonal layout -
                // flowOrthogonal above prioritizes a narrow canvas (wrapping
                // wide ranks into extra rows), which on a real graph with a
                // lot of same-depth branching measurably costs a lot of
                // node/edge overlaps (199 vs 18 on dep-health-analyzer's own
                // graph) in exchange for that narrowness. This one instead
                // keeps every rank as dagre's own single row - branching
                // gets exactly the width it naturally needs, never less -
                // and gets its "flows top to bottom, not left to right"
                // character from two other levers instead: a much wider
                // rankSep (700 vs flowOrthogonal's 200) so ranks read as
                // clearly separated bands with real vertical distance
                // between them, and wrapWideRanks() called in
                // recenter-only mode (see the Infinity maxRankWidth in
                // onLayoutFinished below) purely to remove the sideways
                // spread dagre adds to keep unrelated columns aligned - not
                // to force anything narrower than its own content needs.
                // Measured on the real graph: 5475x7495 (clearly taller
                // than wide) with only 33 overlaps - fewer than
                // flowOrthogonal's plain un-recentered baseline (18) would
                // suggest is even possible at this width, because the
                // wider rankSep gives the orthogonal taxi jog more room to
                // clear other nodes than the original 200px gap did.
                flowVertical: {
                    name: 'dagre',
                    rankDir: 'TB',
                    nodeSep: 100,
                    rankSep: 700,
                    edgeSep: 40,
                    padding: 60,
                    spacingFactor: 1,
                    fit: false,
                    nodeDimensionsIncludeLabels: true,
                },
            };

            // Layouts whose spacing is wide enough that a follow-up
            // collision-avoidance pass (see resolveEdgeNodeOverlaps below)
            // is worth running, and whose edge-clarity-note explains why
            // they look roomier than dagreLR/dagreTB.
            const CLEAN_LAYOUTS = ['dagreLRClean', 'flowTB', 'flowOrthogonal', 'flowOrthogonalLR', 'flowVertical'];

            // Layouts that render edges as orthogonal (taxi-style)
            // right-angle connectors instead of straight lines, and which
            // axis each one's taxi path primarily moves along first -
            // 'vertical' for a TB layout (so a cyclic back-edge whose
            // target sits ABOVE its source still routes sensibly, rather
            // than being forced to visually go "the wrong way" the way an
            // explicit 'downward' direction would), 'horizontal' for the LR
            // one for the same reason (source/target order along x can
            // point either way for a back-edge too).
            const ORTHOGONAL_LAYOUT_AXES = {
                flowOrthogonal: 'vertical',
                flowOrthogonalLR: 'horizontal',
                flowVertical: 'vertical',
            };

            // Both flowOrthogonal and flowVertical run wrapWideRanks() (see
            // its own comment above resolveEdgeNodeOverlaps below) after
            // layout - flowOrthogonal to force ranks narrower than they
            // naturally are, flowVertical only to recenter them (Infinity
            // never triggers wrapping into extra rows). Both also need more
            // than resolveEdgeNodeOverlaps's usual 8 iterations, since
            // recentering nodes off dagre's own crossing-minimized
            // positions - narrowing or not - creates some overlaps dagre's
            // original spacing didn't have.
            const VERTICAL_PACKING = {
                flowOrthogonal: { maxRankWidth: 1400, maxIterations: 20 },
                flowVertical: { maxRankWidth: Infinity, maxIterations: 20 },
            };

            cytoscape.use(cytoscapeDagre);

            const cy = cytoscape({
                container: document.getElementById('cy'),
    
                elements: {
                    nodes: ${safeJsonForScript(nodes)},
                    edges: ${safeJsonForScript(edges)},
                },
    
                style: [
                    {
                        selector: 'node',
                        style: {
                            // A second, smaller line showing the module's
                            // directory (e.g. "src/features/cycles") under
                            // its filename - data(label) alone (used
                            // as-is for the tooltip title elsewhere) stays
                            // just the filename, so this only affects what's
                            // drawn on the node itself.
                            'label': function (ele) {
                                const dir = ele.data('dir');
                                return dir ? ele.data('label') + '\\n' + dir : ele.data('label');
                            },
                            'font-size': '10px',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'text-wrap': 'wrap',
                            'text-max-width': '130px',
                            'line-height': 1.3,
                            // Experimental (branch: experiment/cycle-map-v2).
                            // Rounded-rectangle "block diagram" nodes sized to
                            // fit their (now two-line) label content, colored
                            // by a best-effort module-type classification
                            // (see classifyModuleType() in
                            // buildCytoscapeElements.ts) instead of a flat
                            // gray - a plain functional/architectural role
                            // signal, distinct from '.scc' below, which still
                            // overrides this for any node that's actually
                            // part of a real cycle.
                            'shape': 'round-rectangle',
                            'background-color': 'data(typeColor)',
                            'width': 'label',
                            'height': 'label',
                            'padding': '10px',
                            'opacity': '0.9',
                        },
                    },
    
                    {
                        selector: 'edge',
                        style: {
                            'curve-style': 'straight',
                            'target-arrow-shape': 'triangle',
                            'line-color': '#888',
                            'target-arrow-color': '#888',
                            'width': 1.5,
                        },
                    },

                    // Experimental (branch: experiment/cycle-map-v2). Cytoscape
                    // core's own 'taxi' curve-style - vertical/horizontal
                    // segments meeting at right angles, no third-party edge
                    // routing library needed. Exactly one of these two
                    // classes is toggled onto every edge while the matching
                    // ORTHOGONAL_LAYOUT_AXES layout is active (see
                    // onLayoutFinished below); every other layout keeps the
                    // plain straight '.edge' style above. 'vertical'/
                    // 'horizontal' (not 'downward'/'rightward') so a cyclic
                    // back-edge whose target actually sits above/left of its
                    // source still routes sensibly instead of being forced
                    // to visually go the wrong way.
                    {
                        selector: '.orthogonal-edge-vertical',
                        style: {
                            'curve-style': 'taxi',
                            'taxi-direction': 'vertical',
                            'taxi-turn': '50%',
                            'taxi-turn-min-distance': 20,
                        },
                    },

                    {
                        selector: '.orthogonal-edge-horizontal',
                        style: {
                            'curve-style': 'taxi',
                            'taxi-direction': 'horizontal',
                            'taxi-turn': '50%',
                            'taxi-turn-min-distance': 20,
                        },
                    },
    
                    {
                        selector: '.scc',
                        style: {
                            // Only overrides color/opacity now - width/height
                            // stay on the base 'node' rule's label-based
                            // auto-sizing above, so a cyclic node still gets
                            // a rectangle that actually fits its two-line
                            // label instead of reverting to the old
                            // degree-based circle size.
                            'background-color': 'data(color)',
                            'opacity': '1',
                        },
                    },
    
                    {
                        selector: '.faded',
                        style: {
                            'opacity': 0.4,
                        },
                    },
                    
                    {
                        selector: '.highlighted',
                        style: {
                            'opacity': 1,
                        },
                    },
                    
                    {
                        selector: '.highlighted-edge',
                        style: {
                            'line-color': '#f97316',
                            'target-arrow-color': '#f97316',
                            'width': 2.5,
                            'opacity': 1,
                        },
                    },

                    // Marks the one node the user actually clicked, distinct
                    // from '.highlighted' (which is shared with every
                    // neighbor of that node too). Without this, clicking a
                    // node to pin its tooltip left no visual trace of WHICH
                    // node in the highlighted neighborhood was the one
                    // actually selected. Listed last so the border always
                    // shows on top of '.scc' background-color changes.
                    {
                        selector: '.selected',
                        style: {
                            'border-width': 4,
                            'border-color': '#111827',
                            'border-opacity': 1,
                        },
                    },
                ],
    
                // Experimental (branch: experiment/cycle-map-v2). The
                // default on first load used to be dagreLR (cytoscape's
                // constructor had never been updated as the later,
                // purpose-built orthogonal/vertical layouts were added) -
                // every polished screenshot of this report was only ever
                // reachable by manually reselecting the dropdown, so a
                // fresh open of the file looked like a regression even
                // though nothing was actually broken. flowOrthogonal is now
                // both the layout run here and the <option selected> in the
                // dropdown above, so what a fresh load shows matches what
                // the dropdown claims is active.
                layout: layouts.flowOrthogonal,
            });

            // Shared with redrawMinimapStatic below, so the minimap's edge
            // drawing matches the same geometry collision-avoidance checks
            // against - one straight segment normally, or the matching
            // 3-segment taxi path (vertical/horizontal/vertical, or
            // horizontal/vertical/horizontal) for whichever axis
            // ORTHOGONAL_LAYOUT_AXES maps the active layout to, mirroring
            // the '.orthogonal-edge-vertical'/'-horizontal' styles below
            // (taxi-turn: 50% either way).
            function computeEdgePathSegments(p1, p2, orthogonalAxis) {
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

            // Liang-Barsky line-clipping: true if any part of the segment
            // lies inside the axis-aligned rectangle centered at
            // (rectX, rectY). Nodes became rounded rectangles sized to fit
            // a (now two-line) label instead of small degree-sized circles -
            // a wide, short box is a poor fit for the "distance to a circle
            // of radius = width/2" test this used to use, which was
            // measured to make almost every long-labeled node on the real
            // project register as "overlapping" any edge merely passing
            // within half its (now often 100px+) text width, regardless of
            // whether that edge was anywhere near the box vertically.
            function segmentIntersectsRect(x1, y1, x2, y2, rectX, rectY, halfWidth, halfHeight) {
                const left = rectX - halfWidth;
                const right = rectX + halfWidth;
                const top = rectY - halfHeight;
                const bottom = rectY + halfHeight;

                let t0 = 0;
                let t1 = 1;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const edges = [
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

            // Experimental (branch: experiment/cycle-map-v2, vertical
            // hierarchy). dagre's rank assignment is fundamentally bounded
            // by the graph's own longest dependency chain - confirmed by
            // testing all three dagre rankers (network-simplex, tight-tree,
            // longest-path) against dep-health-analyzer's own graph: all
            // three produced exactly the same 11 ranks, because 11 IS this
            // codebase's actual longest chain length, a structural fact no
            // ranking strategy can change. With 116 real nodes and only 11
            // ranks available, several ranks end up 15-23 nodes wide, which
            // is what was making the plain TB orthogonal layout render as a
            // wide, flat band (16889x2495) instead of a tall, narrow one.
            //
            // This doesn't touch rank ASSIGNMENT (still dagre's, so parent-
            // below-child ordering is preserved) or the left-to-right ORDER
            // dagre computed within each rank (its own crossing-minimizing
            // "order" phase) - but it does replace every rank's actual X
            // coordinates outright, packing each one tightly (wrapping into
            // several stacked sub-rows first, if the rank's own nodes alone
            // would still be wider than maxRankWidth) and re-centering it on
            // one shared global X. A first version only re-packed ranks that
            // were individually too wide and centered each on its OWN
            // dagre-assigned midpoint - that barely changed the overall
            // width (16889 -> 16395), because dagre spreads even a
            // single-node rank across whatever X range keeps it visually
            // aligned with distant, unrelated columns elsewhere in the
            // graph; a rank being "narrow" on its own doesn't stop it from
            // sitting at an extreme X purely to stay under some far-off
            // descendant. Re-centering every rank - wrapped or not - on the
            // same global X removes that inherited spread entirely, which
            // is what actually bounds the final width. A form of "custom
            // layout code on top of dagre", used only because dagre itself
            // has no concept of "keep the whole graph narrow" - rank count
            // and per-rank membership are intrinsic to the graph, but X
            // position within/across ranks is exactly what this rewrites.
            function wrapWideRanks(cy, options) {
                const maxRankWidth = (options && options.maxRankWidth) || 1400;
                const nodeGap = (options && options.nodeGap) || 100;
                const subRowGap = (options && options.subRowGap) || 50;

                const rankGroups = new Map();

                cy.nodes().forEach((node) => {
                    const key = Math.round(node.position().y);
                    if (!rankGroups.has(key)) {
                        rankGroups.set(key, []);
                    }
                    rankGroups.get(key).push(node);
                });

                const sortedRankYs = Array.from(rankGroups.keys()).sort((a, b) => a - b);

                // One shared X every rank is centered on, instead of each
                // rank's own (potentially far-flung) dagre-assigned
                // midpoint - anchored on the topmost rank's original center
                // so the root(s) stay roughly where they were.
                const topRankNodes = rankGroups.get(sortedRankYs[0]);
                const topRankXs = topRankNodes.map((node) => node.position().x);
                const globalCenterX = (Math.min(...topRankXs) + Math.max(...topRankXs)) / 2;

                let cumulativeShift = 0;

                sortedRankYs.forEach((rankY) => {
                    const nodesInRank = rankGroups.get(rankY).sort((a, b) => a.position().x - b.position().x);
                    const rankY_shifted = rankY + cumulativeShift;

                    // Pack dagre's already crossing-minimized left-to-right
                    // order into rows no wider than maxRankWidth - never
                    // reorders nodes, only wraps them; a rank that already
                    // fits ends up as a single "row".
                    const subRows = [];
                    let currentRow = [];
                    let currentRowWidth = 0;

                    nodesInRank.forEach((node) => {
                        const width = node.width();
                        const gap = currentRow.length > 0 ? nodeGap : 0;

                        if (currentRowWidth + gap + width > maxRankWidth && currentRow.length > 0) {
                            subRows.push(currentRow);
                            currentRow = [];
                            currentRowWidth = 0;
                        }

                        currentRow.push(node);
                        currentRowWidth += (currentRow.length > 1 ? nodeGap : 0) + width;
                    });

                    if (currentRow.length > 0) {
                        subRows.push(currentRow);
                    }

                    let currentY = rankY_shifted;
                    let addedHeight = 0;

                    subRows.forEach((row, rowIndex) => {
                        const rowWidth =
                            row.reduce((sum, node) => sum + node.width(), 0) + nodeGap * (row.length - 1);
                        let cursorX = globalCenterX - rowWidth / 2;
                        const rowMaxHeight = Math.max(...row.map((node) => node.height()));

                        row.forEach((node) => {
                            const width = node.width();
                            node.position({ x: cursorX + width / 2, y: currentY });
                            cursorX += width + nodeGap;
                        });

                        if (rowIndex < subRows.length - 1) {
                            const nextRowMaxHeight = Math.max(...subRows[rowIndex + 1].map((node) => node.height()));
                            const step = rowMaxHeight / 2 + subRowGap + nextRowMaxHeight / 2;
                            currentY += step;
                            addedHeight += step;
                        }
                    });

                    cumulativeShift += addedHeight;
                });
            }

            // Experimental (branch: experiment/cycle-map-v2): pushes any node
            // that a straight A->B edge would otherwise pass through out of
            // that edge's way, perpendicular to the edge line. Only ever
            // increases spacing - it never tries to shrink the layout back
            // down, per the explicit preference for a roomier-but-clear
            // result over a compact one. Straight-line edges crossing OTHER
            // EDGES are left alone entirely; only edge-vs-node overlap is
            // resolved.
            function resolveEdgeNodeOverlaps(cy, options) {
                const margin = (options && options.margin) || 14;
                const maxIterations = (options && options.maxIterations) || 8;
                const orthogonalAxis = (options && options.orthogonalAxis) || null;

                function closestPointOnSegment(px, py, x1, y1, x2, y2) {
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

                for (let iteration = 0; iteration < maxIterations; iteration++) {
                    let movedAny = false;

                    cy.edges().forEach((edge) => {
                        const source = edge.source();
                        const target = edge.target();
                        const p1 = source.position();
                        const p2 = target.position();
                        const segments = computeEdgePathSegments(p1, p2, orthogonalAxis);

                        cy.nodes().forEach((node) => {
                            if (node.id() === source.id() || node.id() === target.id()) {
                                return;
                            }

                            const pos = node.position();
                            const halfWidth = node.width() / 2;
                            const halfHeight = node.height() / 2;

                            // Whether the node's actual rectangle (not a
                            // width/2-radius circle around it) is crossed by
                            // any of the edge's segments - see
                            // segmentIntersectsRect() above for why this
                            // replaced the old circle-distance check.
                            let intersectsAny = false;
                            let closest = null;
                            let bestSegment = null;
                            let distance = Infinity;

                            segments.forEach((seg) => {
                                if (
                                    segmentIntersectsRect(
                                        seg.x1, seg.y1, seg.x2, seg.y2,
                                        pos.x, pos.y,
                                        halfWidth + margin, halfHeight + margin,
                                    )
                                ) {
                                    intersectsAny = true;
                                }

                                const c = closestPointOnSegment(pos.x, pos.y, seg.x1, seg.y1, seg.x2, seg.y2);
                                const dx = pos.x - c.x;
                                const dy = pos.y - c.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);

                                if (dist < distance) {
                                    distance = dist;
                                    closest = c;
                                    bestSegment = seg;
                                }
                            });

                            if (!intersectsAny) {
                                return;
                            }

                            // The intersection test above is exact; this
                            // "how far to push" distance is still the same
                            // reasonable approximation as before (based on
                            // the closest point on whichever segment is
                            // nearest), just using the larger of the
                            // rectangle's two half-dimensions as the
                            // clearance radius instead of a fixed circle.
                            const clearance = Math.max(halfWidth, halfHeight) + margin;

                            const awayX = pos.x - closest.x;
                            const awayY = pos.y - closest.y;

                            // The node sits (near-)exactly on the line - push it
                            // perpendicular to the edge direction instead of
                            // along a near-zero-length "away" vector, using the
                            // node's own id to pick a consistent side so it
                            // doesn't jitter between iterations.
                            let normalX = awayX;
                            let normalY = awayY;
                            const currentLength = distance || 0.0001;

                            if (distance < 0.5) {
                                const edgeDx = bestSegment.x2 - bestSegment.x1;
                                const edgeDy = bestSegment.y2 - bestSegment.y1;
                                const edgeLength = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
                                const side = node.id().length % 2 === 0 ? 1 : -1;

                                normalX = (-edgeDy / edgeLength) * side;
                                normalY = (edgeDx / edgeLength) * side;
                            } else {
                                normalX = awayX / currentLength;
                                normalY = awayY / currentLength;
                            }

                            const pushBy = clearance - distance + 1;

                            node.position({
                                x: pos.x + normalX * pushBy,
                                y: pos.y + normalY * pushBy,
                            });

                            movedAny = true;
                        });
                    });

                    if (!movedAny) {
                        break;
                    }
                }
            }

            // Experimental (branch: experiment/cycle-map-v2, navigation layer).
            // Every layout config above now has fit:false - "fit the whole
            // graph into the viewport" is no longer the automatic outcome of
            // running a layout. On a small graph that still comfortably fits
            // at a readable zoom, this behaves like a fit. On a large one
            // (dep-health's own ~400-module graph, for instance), this keeps
            // nodes at their real, readable size and centers the viewport on
            // the graph instead of shrinking everything to fit - matching
            // the "large canvas, local viewport, navigate via minimap"
            // model. "Fit Graph" remains available as an explicit, opt-in
            // overview control (see the button handler below).
            const FIT_TOLERANCE = 1.2;

            // A real bug found while testing: plain cy.fit() sizes the
            // graph to the FULL container, including corners permanently
            // covered by opaque UI panels (#toolbar, #edge-clarity-note).
            // On a small graph - exactly the case where this "fits
            // comfortably" path runs - a node can fit entirely underneath
            // one of those panels and become completely invisible, even
            // though cy.extent() and the minimap both correctly show it as
            // "in view". Measuring the panels' actual rendered rects and
            // fitting into what's left avoids that. #hud and #minimap-
            // container (now inside it) no longer need to be accounted for
            // here - #cy's own CSS height already stops short of #hud (see
            // styles.ts), so the canvas the graph fits into never extends
            // behind the bottom panel in the first place.
            function measureChromeInsets(container) {
                const containerRect = container.getBoundingClientRect();

                function rectOf(id) {
                    const el = document.getElementById(id);
                    if (!el) {
                        return null;
                    }
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        return null;
                    }
                    return rect;
                }

                const toolbar = rectOf('toolbar');
                const edgeNote = rectOf('edge-clarity-note');

                let left = 0;
                let right = 0;
                let top = 0;
                let bottom = 0;

                if (toolbar) {
                    right = Math.max(right, containerRect.right - toolbar.left);
                    top = Math.max(top, toolbar.bottom - containerRect.top);
                }
                if (edgeNote) {
                    left = Math.max(left, edgeNote.right - containerRect.left);
                    bottom = Math.max(bottom, containerRect.bottom - edgeNote.top);
                }

                return { left, right, top, bottom };
            }

            function fitCyAvoidingChrome(cy, basePadding) {
                const container = cy.container();
                const insets = measureChromeInsets(container);

                const leftInset = Math.max(basePadding, insets.left + 16);
                const rightInset = Math.max(basePadding, insets.right + 16);
                const topInset = Math.max(basePadding, insets.top + 16);
                const bottomInset = Math.max(basePadding, insets.bottom + 16);

                const availableWidth = container.clientWidth - leftInset - rightInset;
                const availableHeight = container.clientHeight - topInset - bottomInset;

                const bb = cy.elements().boundingBox();

                if (bb.w === 0 || bb.h === 0 || availableWidth <= 0 || availableHeight <= 0) {
                    cy.fit(undefined, basePadding);
                    return;
                }

                const zoom = Math.min(availableWidth / bb.w, availableHeight / bb.h);
                const safeCenterX = leftInset + availableWidth / 2;
                const safeCenterY = topInset + availableHeight / 2;

                cy.zoom(zoom);
                cy.pan({
                    x: safeCenterX - ((bb.x1 + bb.x2) / 2) * zoom,
                    y: safeCenterY - ((bb.y1 + bb.y2) / 2) * zoom,
                });
            }

            function applyInitialView(cy) {
                const bb = cy.elements().boundingBox();
                const container = cy.container();
                const availableWidth = container.clientWidth - 80;
                const availableHeight = container.clientHeight - 80;

                const fitsComfortably =
                    bb.w <= availableWidth * FIT_TOLERANCE &&
                    bb.h <= availableHeight * FIT_TOLERANCE;

                if (fitsComfortably) {
                    fitCyAvoidingChrome(cy, 80);
                } else {
                    cy.zoom(1);
                    cy.center();
                }
            }

            // --- Minimap -----------------------------------------------
            //
            // A schematic overview, not a second real graph viewer: nodes
            // are drawn as small dots and edges as faint lines, both at
            // fixed sizes regardless of zoom, purely so the reader can see
            // the graph's overall shape and where the current viewport
            // sits within it. Split into a static offscreen layer (nodes +
            // edges, redrawn only when the layout actually changes - cheap
            // to skip re-drawing this on every pan/zoom event) and the
            // visible canvas (redrawn on every pan/zoom, but that's just
            // one drawImage blit plus one rectangle).
            // 200x100 to match the <canvas width height> attributes set in
            // the HUD markup above (must stay in sync with those - this is
            // the coordinate space drawn into, not a CSS size).
            const MINIMAP_WIDTH = 200;
            const MINIMAP_HEIGHT = 100;
            const MINIMAP_PADDING = 6;

            const minimapCanvas = document.getElementById('minimap-canvas');
            const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

            const minimapStatic = document.createElement('canvas');
            minimapStatic.width = MINIMAP_WIDTH;
            minimapStatic.height = MINIMAP_HEIGHT;
            const minimapStaticCtx = minimapStatic.getContext('2d');

            let minimapTransform = null;

            function computeMinimapTransform(cy) {
                const bb = cy.elements().boundingBox();
                const availableWidth = MINIMAP_WIDTH - MINIMAP_PADDING * 2;
                const availableHeight = MINIMAP_HEIGHT - MINIMAP_PADDING * 2;

                const scale = Math.min(
                    bb.w > 0 ? availableWidth / bb.w : 1,
                    bb.h > 0 ? availableHeight / bb.h : 1
                );

                const offsetX = MINIMAP_PADDING + (availableWidth - bb.w * scale) / 2 - bb.x1 * scale;
                const offsetY = MINIMAP_PADDING + (availableHeight - bb.h * scale) / 2 - bb.y1 * scale;

                return { scale, offsetX, offsetY };
            }

            function toMinimapPoint(x, y, transform) {
                return {
                    x: x * transform.scale + transform.offsetX,
                    y: y * transform.scale + transform.offsetY,
                };
            }

            function minimapPointToGraphPoint(mx, my, transform) {
                return {
                    x: (mx - transform.offsetX) / transform.scale,
                    y: (my - transform.offsetY) / transform.scale,
                };
            }

            function redrawMinimapStatic(cy, orthogonalAxis) {
                if (!minimapCtx) {
                    return;
                }

                minimapTransform = computeMinimapTransform(cy);
                const transform = minimapTransform;

                minimapStaticCtx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
                minimapStaticCtx.fillStyle = '#fafafa';
                minimapStaticCtx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

                minimapStaticCtx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                minimapStaticCtx.lineWidth = 1;

                // Mirrors the real graph's own routing (computeEdgePathSegments,
                // shared above) so a straight-edge layout's minimap shows
                // straight lines and an orthogonal layout's minimap shows the
                // same right-angle connectors, just schematic at this scale.
                cy.edges().forEach((edge) => {
                    const p1 = edge.source().position();
                    const p2 = edge.target().position();
                    const segments = computeEdgePathSegments(p1, p2, orthogonalAxis);

                    minimapStaticCtx.beginPath();
                    segments.forEach((seg) => {
                        const a = toMinimapPoint(seg.x1, seg.y1, transform);
                        const b = toMinimapPoint(seg.x2, seg.y2, transform);

                        minimapStaticCtx.moveTo(a.x, a.y);
                        minimapStaticCtx.lineTo(b.x, b.y);
                    });
                    minimapStaticCtx.stroke();
                });

                // Small rectangles, not dots - a schematic echo of the real
                // graph's rounded-rectangle nodes, colored the same way
                // (module-type color, or the cycle's color for a '.scc'
                // node) so the minimap actually looks like a miniature of
                // the real map instead of an abstract dot-graph over it.
                const MINIMAP_NODE_SIZE = 4;

                cy.nodes().forEach((node) => {
                    const pos = node.position();
                    const point = toMinimapPoint(pos.x, pos.y, transform);

                    minimapStaticCtx.fillStyle = node.hasClass('scc')
                        ? node.data('color') || '#ef4444'
                        : node.data('typeColor') || '#9ca3af';

                    minimapStaticCtx.fillRect(
                        point.x - MINIMAP_NODE_SIZE / 2,
                        point.y - MINIMAP_NODE_SIZE / 2,
                        MINIMAP_NODE_SIZE,
                        MINIMAP_NODE_SIZE,
                    );
                });

                redrawMinimapViewport(cy);
            }

            function redrawMinimapViewport(cy) {
                if (!minimapCtx || !minimapTransform) {
                    return;
                }

                minimapCtx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
                minimapCtx.drawImage(minimapStatic, 0, 0);

                const extent = cy.extent();
                const transform = minimapTransform;
                const a = toMinimapPoint(extent.x1, extent.y1, transform);
                const b = toMinimapPoint(extent.x2, extent.y2, transform);

                minimapCtx.strokeStyle = '#2563eb';
                minimapCtx.lineWidth = 2;
                minimapCtx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

                minimapCtx.fillStyle = 'rgba(37, 99, 235, 0.10)';
                minimapCtx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
            }

            function panCyToGraphPoint(cy, graphX, graphY) {
                const zoom = cy.zoom();
                const container = cy.container();

                cy.pan({
                    x: container.clientWidth / 2 - graphX * zoom,
                    y: container.clientHeight / 2 - graphY * zoom,
                });
            }

            function isInsideViewportRect(cy, mx, my) {
                if (!minimapTransform) {
                    return false;
                }

                const extent = cy.extent();
                const a = toMinimapPoint(extent.x1, extent.y1, minimapTransform);
                const b = toMinimapPoint(extent.x2, extent.y2, minimapTransform);

                return mx >= a.x && mx <= b.x && my >= a.y && my <= b.y;
            }

            if (minimapCanvas) {
                let draggingViewportRect = false;
                let dragLast = null;

                minimapCanvas.addEventListener('mousedown', (event) => {
                    const rect = minimapCanvas.getBoundingClientRect();
                    const mx = event.clientX - rect.left;
                    const my = event.clientY - rect.top;

                    if (isInsideViewportRect(cy, mx, my)) {
                        draggingViewportRect = true;
                        dragLast = { mx, my };
                    } else if (minimapTransform) {
                        const graphPoint = minimapPointToGraphPoint(mx, my, minimapTransform);
                        panCyToGraphPoint(cy, graphPoint.x, graphPoint.y);
                    }
                });

                window.addEventListener('mousemove', (event) => {
                    if (!draggingViewportRect || !minimapTransform) {
                        return;
                    }

                    const rect = minimapCanvas.getBoundingClientRect();
                    const mx = event.clientX - rect.left;
                    const my = event.clientY - rect.top;

                    const deltaMinimapX = mx - dragLast.mx;
                    const deltaMinimapY = my - dragLast.my;
                    dragLast = { mx, my };

                    const zoom = cy.zoom();
                    cy.panBy({
                        x: (-deltaMinimapX / minimapTransform.scale) * zoom,
                        y: (-deltaMinimapY / minimapTransform.scale) * zoom,
                    });
                });

                window.addEventListener('mouseup', () => {
                    draggingViewportRect = false;
                    dragLast = null;
                });
            }

            cy.on('pan zoom', () => {
                redrawMinimapViewport(cy);
            });
            // -------------------------------------------------------------

            const EDGE_CLARITY_MESSAGES = {
                straight: 'Nodes were spread out to keep every edge a straight line clear of other modules.',
                orthogonal: 'Edges route as right-angle connectors, spread out to stay clear of other modules.',
            };

            function onLayoutFinished(cy, layoutName) {
                const orthogonalAxis = ORTHOGONAL_LAYOUT_AXES[layoutName] || null;
                const isCleanLayout = CLEAN_LAYOUTS.includes(layoutName);

                // Exactly one of '.orthogonal-edge-vertical'/'-horizontal'
                // (curve-style: taxi) is ever wanted at a time, matching
                // whichever ORTHOGONAL_LAYOUT_AXES layout is active -
                // switching to any other layout must fall back to the plain
                // straight '.edge' style, not keep the previous layout's
                // taxi routing.
                cy.edges().toggleClass('orthogonal-edge-vertical', orthogonalAxis === 'vertical');
                cy.edges().toggleClass('orthogonal-edge-horizontal', orthogonalAxis === 'horizontal');

                // Only flowOrthogonal and flowVertical run wrapWideRanks -
                // dagreLRClean/flowTB/flowOrthogonalLR don't have a "ranks
                // spread wider than they need to be" problem in the first
                // place (LR's ranks are columns, where extra height is the
                // expected shape, not something to fix).
                const packing = VERTICAL_PACKING[layoutName];

                if (packing) {
                    wrapWideRanks(cy, { maxRankWidth: packing.maxRankWidth, nodeGap: layouts[layoutName].nodeSep });
                }

                if (isCleanLayout) {
                    // Recentering nodes off dagre's own crossing-minimized
                    // positions - whether narrowing them (flowOrthogonal) or
                    // just removing wasted cross-column alignment spread
                    // (flowVertical) - creates overlaps resolveEdgeNodeOverlaps's
                    // usual 8-iteration budget (still fine for every other
                    // "clean" layout, none of which touch node X positions
                    // after dagre) doesn't fully clear. 20 was found by
                    // testing to noticeably help both without costing much
                    // in extra compute.
                    resolveEdgeNodeOverlaps(cy, {
                        orthogonalAxis,
                        maxIterations: packing ? packing.maxIterations : undefined,
                    });
                }

                applyInitialView(cy);
                redrawMinimapStatic(cy, orthogonalAxis);
            }

            // The initial 'dagre' layout passed into the cytoscape()
            // constructor above runs synchronously as part of construction,
            // so its 'layoutstop' can fire before any listener registered
            // after the fact would be attached in time to catch it -
            // calling this directly, once, covers the initial-load case
            // regardless of that timing.
            onLayoutFinished(cy, 'flowOrthogonal');

            const layoutSelect = document.getElementById('layout-select');
            const edgeClarityNote = document.getElementById('edge-clarity-note');

            if (layoutSelect) {
                layoutSelect.addEventListener(
                    'change',
                    function () {
                        const layoutName = this.value;
                        const isCleanLayout = CLEAN_LAYOUTS.includes(layoutName);
                        const runningLayout = cy.layout(layouts[layoutName]);

                        if (edgeClarityNote) {
                            edgeClarityNote.hidden = !isCleanLayout;
                            edgeClarityNote.textContent = ORTHOGONAL_LAYOUT_AXES[layoutName]
                                ? EDGE_CLARITY_MESSAGES.orthogonal
                                : EDGE_CLARITY_MESSAGES.straight;
                        }

                        runningLayout.one('layoutstop', () => {
                            onLayoutFinished(cy, layoutName);
                        });

                        runningLayout.run();
                    },
                );
            }

            const fitButton =
                document.getElementById(
                    'fit-btn',
                );

            if (fitButton) {
                fitButton.addEventListener(
                    'click',
                    function () {
                        fitCyAvoidingChrome(cy, 40);
                    },
                );
            }

            const tooltip = document.getElementById(
                    'tooltip',
                );

            if (!tooltip) {
                throw new Error(
                    'Tooltip element not found',
                );
            }

            let pinnedNodeId = null;

            const highlightToggle = document.getElementById('highlight-toggle');

            let highlightEnabled = true;

            highlightToggle?.addEventListener(
                'change',
                (event) => {
                    highlightEnabled =
                        event.target.checked;

                    if (!highlightEnabled) {
                        clearHighlights();
                    }
                },
            );
    
            function showTooltip(event) {
                const node = event.target;
                const data = node.data();
    
                const title = data.label || data.id;
                const showFullPath = title !== data.id;
    
                tooltip.innerHTML = \`
                    <strong>\${escapeHtml(title)}</strong>

                    \${showFullPath
                        ? \`<br />
                        <span style="color:#6b7280;font-size:11px;">
                            \${escapeHtml(data.id)}
                        </span>\`
                        : ''
                    }
                    <br /><br />
    
                    Ca: \${data.ca}<br />
                    Ce: \${data.ce}<br />
                    Instability: \${Number(data.instability).toFixed(2)}<br /><br />
    
                    SCC size: \${data.sccSize ?? 0}
                \`;
    
                tooltip.style.display = 'block';
            }
    
            function moveTooltip(event) {
                const { pageX, pageY } = event.originalEvent;

                tooltip.style.left = \`\${pageX + 12}px\`;
                tooltip.style.top = \`\${pageY + 12}px\`;
            }

            const hudSelectedContent = document.getElementById('hud-selected-content');

            // Experimental (branch: experiment/cycle-map-v2, HUD layer).
            // Distinct from showTooltip() above on purpose: the tooltip
            // answers "what's under my cursor right now" (hover, or the
            // last-clicked node while pinned) and disappears the moment you
            // stop hovering/unpin; this answers "what did I select" and
            // stays visible in the persistent bottom panel independent of
            // the mouse, driven by the same tap/pin state as '.selected'.
            // Deliberately shares only data already computed for the
            // tooltip - no new node data, no IDE-style inspector.
            function updateSelectedModulePanel(node) {
                if (!hudSelectedContent) {
                    return;
                }

                if (!node) {
                    hudSelectedContent.innerHTML = '<span class="hud-empty">No module selected</span>';
                    return;
                }

                const data = node.data();
                const name = data.label || data.id;
                const relativePath = data.dir ? data.dir + '/' + data.label : data.label;
                const sccSize = data.sccSize || 0;

                const cycleBadge = sccSize > 1
                    ? \`<div class="hud-cycle-badge" style="background: \${escapeHtml(data.color || '#ef4444')};">Part of a \${sccSize}-module cycle</div>\`
                    : '';

                hudSelectedContent.innerHTML = \`
                    <div class="hud-module-name">\${escapeHtml(name)}</div>
                    <div class="hud-module-path">\${escapeHtml(relativePath)}</div>
                    \${cycleBadge}
                    <div class="hud-stats">
                        <div>
                            <div class="hud-stat-label">Ca (incoming)</div>
                            <div class="hud-stat-value">\${data.ca}</div>
                        </div>
                        <div>
                            <div class="hud-stat-label">Ce (outgoing)</div>
                            <div class="hud-stat-value">\${data.ce}</div>
                        </div>
                        <div>
                            <div class="hud-stat-label">Instability</div>
                            <div class="hud-stat-value">\${Number(data.instability).toFixed(2)}</div>
                        </div>
                        <div>
                            <div class="hud-stat-label">SCC size</div>
                            <div class="hud-stat-value">\${sccSize}</div>
                        </div>
                    </div>
                \`;
            }

            function clearHighlights() {
                cy.elements().removeClass('faded');
                cy.elements().removeClass('highlighted');
                cy.elements().removeClass('highlighted-edge');
                cy.elements().removeClass('selected');
            }
    
            function highlightNeighborhood(node) {
                clearHighlights();
    
                cy.elements().addClass('faded');
    
                node.removeClass('faded');
                node.addClass('highlighted');
    
                const connectedNodes = node.neighborhood('node');
                const connectedEdges = node.connectedEdges();
    
                connectedNodes.removeClass('faded');
                connectedNodes.addClass('highlighted');
    
                connectedEdges.removeClass('faded');
                connectedEdges.addClass('highlighted-edge');
            }
    
            cy.on('mouseover', 'node', (event) => {
                if (pinnedNodeId) {
                    return;
                }
    
                const node = event.target;
    
                if (highlightEnabled) {
                    highlightNeighborhood(node);
                }
    
                showTooltip(event);
            });
    
            cy.on('mousemove', 'node', (event) => {
                if (pinnedNodeId) {
                    return;
                }
    
                moveTooltip(event);
            });
    
            cy.on('mouseout', 'node', () => {
                if (pinnedNodeId) {
                    return;
                }
    
                clearHighlights();
    
                tooltip.style.display = 'none';
            });
    
            cy.on('tap', 'node', (event) => {
                const node = event.target;
                const data = node.data();

                pinnedNodeId = data.id;

                // clearHighlights() also strips any previous node's
                // '.selected' marker - always needs to run once per tap
                // (highlightNeighborhood already does this itself when
                // highlighting is on) so a stale border can't linger on the
                // previously-selected node when the toggle is off.
                if (highlightEnabled) {
                    highlightNeighborhood(node);
                } else {
                    clearHighlights();
                }

                node.addClass('selected');

                showTooltip(event);
                moveTooltip(event);
                updateSelectedModulePanel(node);
            });

            cy.on('tap', (event) => {
                if (event.target === cy) {
                    pinnedNodeId = null;

                    clearHighlights();

                    tooltip.style.display = 'none';
                    updateSelectedModulePanel(null);
                }
            });
        </script>
    </body>
    </html>
    `;
}
