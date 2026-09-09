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
        <div id="hint">
            <strong>Module area</strong><br />
            <span style="font-size: 11px; color: #6b7280;">(from project structure)</span>
            <div id="area-legend" style="display: flex; flex-direction: column; gap: 3px; margin-top: 6px;"></div>
            <br />

            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="highlight-toggle" checked />
                Highlight connected modules
            </label>
        </div>

        <div id="toolbar">
            <label>
                Layout:
                <select id="layout-select">
                    <option value="dagreLR">Dagre LR</option>
                    <option value="dagreTB">Dagre TB</option>
                    <option value="dagreLRClean">Dagre LR (straight edges, no overlap)</option>
                    <option value="flowTB">Flow / Hierarchical (Top to Bottom)</option>
                    <option value="flowOrthogonal">Hierarchical (Orthogonal, Top to Bottom)</option>
                    <option value="flowOrthogonalLR">Hierarchical (Orthogonal, Left to Right)</option>
                    <option value="flowVertical" selected>Hierarchical (Orthogonal, Vertical Flow)</option>
                    <option value="breadthfirst">Breadth First</option>
                    <option value="cose">Force Directed</option>
                </select>
            </label>

            <label>
                Area:
                <select id="area-select">
                    <option value="">All</option>
                </select>
            </label>

            <!-- Experimental (branch: experiment/cycle-map-v2, area filter
                 external connections). Disabled by default - Area starts
                 at "All", where "internal only" vs "with external
                 connections" would show the exact same full graph either
                 way, so this stays disabled (not just silently ignored)
                 until a specific area is selected. See
                 refreshAreaView() below for the full rationale. -->
            <label>
                Connections:
                <select id="connection-select" disabled>
                    <option value="internal" selected>Internal only</option>
                    <option value="external">With external connections</option>
                </select>
            </label>

            <button id="fit-btn">
                Fit Graph
            </button>

            <div id="zoom-controls">
                <button id="zoom-out-btn" aria-label="Zoom out">&minus;</button>
                <span id="zoom-level">100%</span>
                <button id="zoom-in-btn" aria-label="Zoom in">+</button>
            </div>
        </div>

        <div id="edge-clarity-note">
            Edges route as right-angle connectors, spread out to stay clear of other modules.
        </div>

        <!-- Experimental (branch: experiment/cycle-map-v2). #minimap-container
             itself is only ever moved here via CSS/DOM nesting; its canvas
             id and all the drawing/drag JS below are untouched. -->
        <div id="bottom-hud">
            <div id="hud-help">
                <strong>dep-health-analyzer</strong><br /><br />

                Hover over a module to see dependency metrics.<br />
                Click a module <strong>to pin</strong> the tooltip.<br /><br />

                <strong>Ca</strong> — incoming dependencies<br />
                How many modules depend on this module.<br /><br />

                <strong>Ce</strong> — outgoing dependencies<br />
                How many modules this module depends on.<br /><br />

                <strong>Instability</strong><br />
                0.00 = stable module<br />
                1.00 = highly unstable module
                <br /><br />
            </div>

            <div id="hud-selected">
                <span id="hud-selected-body" class="hud-selected-empty">Click a module to see details.</span>
            </div>

            <div id="minimap-container">
                <canvas id="minimap-canvas" width="220" height="160"></canvas>
            </div>
        </div>

        <script>
            // Node labels/ids come from file paths, which could in principle
            // contain HTML if a file were named that way - escape before
            // using innerHTML below, since the selected-module HUD panel is
            // built from a template string, not from text-only DOM APIs.
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

                // Experimental (branch: experiment/cycle-map-v2). Cytoscape's
                // own built-in switch for "don't let mouse wheel/pinch
                // gestures zoom the graph" - this only turns off the USER
                // GESTURE path, not zooming itself: cy.zoom(...) (used by
                // the +/-/Fit Graph controls below, and by
                // applyInitialView/fitCyAvoidingChrome) keeps working
                // exactly as before. Deliberately not a wheel listener with
                // preventDefault()/manual scroll emulation - cytoscape
                // simply never attaches its own zoom-on-wheel handler when
                // this is false, so the wheel event is left completely
                // alone and falls through to whatever the browser's normal
                // (page-level) wheel behavior already is.
                userZoomingEnabled: false,

                elements: {
                    nodes: ${safeJsonForScript(nodes)},
                    edges: ${safeJsonForScript(edges)},
                },
    
                style: [
                    {
                        selector: 'node',
                        style: {
                            // A second, smaller line showing the module's
                            // directory under its filename - reads
                            // data(displayDir), the presentation-only
                            // abbreviation computed in
                            // buildCytoscapeElements.ts (e.g.
                            // "…/ci/reporting" instead of the real, full
                            // "src/features/regression/ci/reporting"),
                            // never data(dir) itself - the bottom HUD's
                            // selected-module panel (updateSelectedModulePanel
                            // below) still shows the real, full data(id), and
                            // data(dir) itself is left completely untouched
                            // on every node - only what gets drawn on the
                            // node's own limited-width box is shortened.
                            'label': function (ele) {
                                const dir = ele.data('displayDir');
                                return dir ? ele.data('label') + '\\n' + dir : ele.data('label');
                            },
                            'font-size': '10px',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'text-wrap': 'wrap',
                            // A path has no spaces, only slashes - cytoscape's
                            // text wrapping (like standard CSS) only breaks at
                            // whitespace, so even a *shortened* displayDir
                            // string is still one unbreakable "word" as far as
                            // wrapping goes, and the box grows past
                            // text-max-width to fit it as one line regardless.
                            // 160px is tuned to comfortably fit
                            // DISPLAY_DIR_MAX_LENGTH's longest real output
                            // (measured on dep-health-analyzer's own graph:
                            // 159px for its single longest displayDir,
                            // "…/reporting/defaultModeReport") without this
                            // setting fighting an outcome computeDisplayDir()
                            // already produces - it isn't the thing actually
                            // keeping nodes bounded, just kept consistent with
                            // what that already does.
                            'text-max-width': '160px',
                            'line-height': 1.3,
                            // Experimental (branch: experiment/cycle-map-v2).
                            // Rounded-rectangle "block diagram" nodes sized to
                            // fit their (now two-line) label content, colored
                            // by module "area" - the first significant
                            // directory segment of the node's own path (see
                            // computeModuleArea() in buildCytoscapeElements.ts)
                            // - instead of a flat gray. A structural grouping
                            // signal derived from the analyzed project's own
                            // real layout, not a guess at architectural
                            // meaning; distinct from '.scc' below, which still
                            // overrides this for any node that's actually
                            // part of a real cycle.
                            'shape': 'round-rectangle',
                            'background-color': 'data(areaColor)',
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

                    // Experimental (branch: experiment/cycle-map-v2, area
                    // filter). Cytoscape's own display:none - the element
                    // stays fully present in cy's data model (nothing is
                    // removed/destroyed), it's just not rendered. Drives the
                    // actual on-screen hiding; the layout/fit/minimap
                    // functions below deliberately do NOT read this back via
                    // cytoscape's ':visible' selector (see visibleNodes()/
                    // visibleEdges()/visibleElements() near the cy
                    // constructor for why - that lags a frame behind this
                    // class actually being set). This is how the area
                    // filter is implemented: a presentation-level
                    // toggle on top of the one full graph, not a second
                    // "filtered graph" data structure.
                    {
                        selector: '.area-hidden',
                        style: {
                            display: 'none',
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
                    // Experimental (branch: experiment/cycle-map-v2, area
                    // filter external connections). '.external-area-proxy'/
                    // '.external-proxy-edge' mark the small, runtime-only
                    // aggregate nodes/edges added by
                    // addExternalConnectionProxies() below when "With
                    // external connections" is active - one proxy node per
                    // external area the selected area actually connects to
                    // (not one per real external module, which is what
                    // would risk turning a small area's view into pulling
                    // in dozens of unrelated real nodes). Diamond shape +
                    // dashed border/line is a deliberately neutral "this
                    // represents something aggregated, not a real single
                    // module" visual cue - no red/orange/warning color, no
                    // judgment implied by a dependency simply crossing an
                    // area boundary. Reuses the real area's own areaColor
                    // (set as this proxy node's data(areaColor) when it's
                    // created) so it still visually matches the legend.
                    {
                        selector: '.external-area-proxy',
                        style: {
                            'shape': 'diamond',
                            'background-color': 'data(areaColor)',
                            'border-width': 2,
                            'border-style': 'dashed',
                            'border-color': '#374151',
                            'opacity': 0.85,
                            'width': 'label',
                            'height': 'label',
                            'padding': '10px',
                            'font-size': '10px',
                            'text-valign': 'center',
                            'text-halign': 'center',
                        },
                    },

                    {
                        selector: '.external-proxy-edge',
                        style: {
                            'curve-style': 'straight',
                            'line-color': '#9ca3af',
                            'target-arrow-color': '#9ca3af',
                            'target-arrow-shape': 'triangle',
                            'line-style': 'dashed',
                            'width': 1.5,
                        },
                    },

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
                    // neighbor of that node too). Without this, selecting a
                    // node left no visual trace of WHICH node in the
                    // highlighted neighborhood was the one actually
                    // selected. Listed last so the border always shows on
                    // top of '.scc' background-color changes.
                    {
                        selector: '.selected',
                        style: {
                            'border-width': 4,
                            'border-color': '#111827',
                            'border-opacity': 1,
                        },
                    },
                ],
    
                // The default on first load used to be dagreLR - every
                // screenshot demonstrating this branch's actual intended
                // result was only ever reachable by manually reselecting
                // the dropdown, making a fresh open of the file look
                // broken even though nothing was. flowVertical is now both
                // the layout run here and the <option selected> above, so
                // what a fresh load shows matches what the dropdown claims
                // is active - this is the layout confirmed as the good,
                // stable checkpoint before the bottom-HUD experiment (see
                // the git tag on this commit).
                layout: layouts.flowVertical,
            });

            // Experimental (branch: experiment/cycle-map-v2, area filter).
            // '' (falsy) means "All" - no area filter applied. The single
            // source of truth for "what is the current view", read by every
            // layout/fit/minimap function below via visibleNodes()/
            // visibleEdges()/visibleElements() instead of cytoscape's own
            // cy.nodes(':visible') - deliberately NOT using cytoscape's
            // built-in ':visible' selector for this: it's driven by the
            // 'display' style property, which toggleClass() only marks
            // dirty synchronously - the actual recomputation (and thus
            // ':visible'/.visible() returning the right answer) was
            // measured to only happen on the NEXT animation frame, not
            // immediately after the class change. Deriving the current
            // view straight from each element's own 'area' data instead
            // (exactly the same test used to decide the '.area-hidden'
            // class in applyAreaFilter below) is instantly correct with no
            // such lag, since it never depends on cytoscape's render-timed
            // style resolution at all - only on data that's already
            // present the moment the area filter changes.
            let currentAreaFilter = '';

            // Experimental (branch: experiment/cycle-map-v2, area filter
            // external connections). 'internal' (default) = only edges
            // between two nodes both inside the selected area, matching
            // the original area-filter behavior exactly. 'external' = also
            // shows the selected area's connections to other areas, via
            // small per-area proxy nodes (see addExternalConnectionProxies
            // below) rather than the real external nodes themselves. Only
            // meaningful when an actual area is selected - see
            // refreshAreaView() for why 'All' ignores this.
            let currentConnectionMode = 'internal';

            // A proxy node/edge is only ever present in cy while it's
            // meant to be shown (added fresh by addExternalConnectionProxies,
            // removed by removeExternalConnectionProxies the moment the
            // area/connection selection changes) - so unlike real
            // nodes/edges, its being IN cy at all already means "currently
            // in view", with nothing further to check against
            // currentAreaFilter.
            function isNodeInCurrentView(node) {
                if (node.data('isExternalProxy')) {
                    return true;
                }

                return !currentAreaFilter || node.data('area') === currentAreaFilter;
            }

            function isEdgeInCurrentView(edge) {
                if (edge.data('isExternalProxy')) {
                    return true;
                }

                return (
                    !currentAreaFilter ||
                    (edge.source().data('area') === currentAreaFilter &&
                        edge.target().data('area') === currentAreaFilter)
                );
            }

            function visibleNodes(cy) {
                return cy.nodes().filter(isNodeInCurrentView);
            }

            function visibleEdges(cy) {
                return cy.edges().filter(isEdgeInCurrentView);
            }

            function visibleElements(cy) {
                return visibleNodes(cy).union(visibleEdges(cy));
            }

            // Experimental (branch: experiment/cycle-map-v2). With
            // userZoomingEnabled: false above, cytoscape never attaches its
            // own wheel handler at all - the raw DOM 'wheel' event on the
            // container is otherwise completely unclaimed. A <canvas> isn't
            // real scrollable page content, so there's no native browser
            // scroll to fall back on for it the way there would be for an
            // overflowing block of text; panning the graph in response to
            // wheel is the closest equivalent to "scroll through a long
            // page" available for a canvas this large - especially useful
            // for a layout as tall as flowVertical's. { passive: false } is
            // required for preventDefault() to have any effect (browsers
            // default wheel listeners to passive for scroll-performance
            // reasons) - there's nothing to actually scroll on this page,
            // but calling it keeps behavior predictable rather than
            // depending on whatever a given browser's un-prevented default
            // wheel action happens to be.
            cy.container().addEventListener(
                'wheel',
                (event) => {
                    event.preventDefault();
                    cy.panBy({ x: -event.deltaX, y: -event.deltaY });
                },
                { passive: false },
            );

            // Experimental (branch: experiment/cycle-map-v2). Builds the
            // "Module area" legend from the areas actually present on
            // this graph's own nodes - never a fixed list, so a different
            // project's real top-level structure shows up automatically
            // instead of a hardcoded core/features/utils/scripts set that
            // only ever matched this one project. Runs once: area/
            // areaColor are plain node data set once in
            // buildCytoscapeElements.ts, unaffected by layout, pan, zoom,
            // or selection, so there's nothing here that would ever need
            // to be redrawn later the way the minimap does.
            // Shared by the legend and the area-filter dropdown below - both
            // need the same "real areas actually present on this graph's
            // own nodes, in a deterministic order" list, computed from the
            // graph's own data rather than any hardcoded name set so it
            // works the same for any analyzed project's real structure.
            function collectAreaInfo(cy) {
                const areaColors = new Map();

                cy.nodes().forEach((node) => {
                    const area = node.data('area');

                    if (area !== undefined && !areaColors.has(area)) {
                        areaColors.set(area, node.data('areaColor'));
                    }
                });

                const sortedAreas = Array.from(areaColors.keys()).sort((a, b) => a.localeCompare(b));

                return { areaColors, sortedAreas };
            }

            function renderAreaLegend(cy) {
                const legend = document.getElementById('area-legend');

                if (!legend) {
                    return;
                }

                const { areaColors, sortedAreas } = collectAreaInfo(cy);

                // data-area (not just the visible text) so the area filter
                // below can toggle a "this is the active area" highlight on
                // the matching row without re-rendering the whole legend.
                legend.innerHTML = sortedAreas
                    .map((area) => {
                        const color = areaColors.get(area);

                        return (
                            '<div data-area="' + escapeHtml(area) + '">' +
                            '<span class="legend-swatch" style="background: ' +
                            escapeHtml(color) +
                            ';"></span>' +
                            escapeHtml(area) +
                            '</div>'
                        );
                    })
                    .join('');
            }

            function updateLegendActiveArea(area) {
                const legend = document.getElementById('area-legend');

                if (!legend) {
                    return;
                }

                legend.querySelectorAll('[data-area]').forEach((row) => {
                    row.classList.toggle('legend-area-active', !!area && row.dataset.area === area);
                });
            }

            // Experimental (branch: experiment/cycle-map-v2, area filter).
            // Same sortedAreas list as the legend, turned into <option>s -
            // 'All' (value '') first and always present, then every real
            // area found on the graph's own nodes, alphabetical for a
            // deterministic order that doesn't depend on node/scan order.
            function populateAreaSelect(cy) {
                const select = document.getElementById('area-select');

                if (!select) {
                    return;
                }

                const { sortedAreas } = collectAreaInfo(cy);

                sortedAreas.forEach((area) => {
                    const option = document.createElement('option');
                    option.value = area;
                    option.textContent = area;
                    select.appendChild(option);
                });
            }

            renderAreaLegend(cy);
            populateAreaSelect(cy);

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

                // visibleNodes(cy) (not the bare cy.nodes()) so a hidden
                // node left over from a previous area filter doesn't get
                // mixed into a rank group alongside currently-visible nodes
                // at whatever stale Y position it was last laid out at.
                visibleNodes(cy).forEach((node) => {
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

                    // visibleEdges(cy)/visibleNodes(cy) throughout -
                    // area-hidden edges/nodes have nothing worth pushing out
                    // of anyone's way, and mixing their stale positions in
                    // would only waste iterations.
                    visibleEdges(cy).forEach((edge) => {
                        const source = edge.source();
                        const target = edge.target();
                        const p1 = source.position();
                        const p2 = target.position();
                        const segments = computeEdgePathSegments(p1, p2, orthogonalAxis);

                        visibleNodes(cy).forEach((node) => {
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
            // graph to the FULL container, including the four corners
            // permanently covered by opaque UI panels (#hint, #toolbar,
            // #minimap-container, #edge-clarity-note). On a small graph -
            // exactly the case where this "fits comfortably" path runs -
            // a node can fit entirely underneath one of those panels and
            // become completely invisible, even though cy.extent() and the
            // minimap both correctly show it as "in view". Measuring the
            // panels' actual rendered rects and fitting into what's left
            // avoids that; the four corners overlap different pairs of
            // panels, so each side's inset is independently the max of
            // only the panels that actually reach that side, not every
            // panel at once.
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

                const hint = rectOf('hint');
                const toolbar = rectOf('toolbar');
                const minimap = rectOf('minimap-container');
                const edgeNote = rectOf('edge-clarity-note');

                let left = 0;
                let right = 0;
                let top = 0;
                let bottom = 0;

                if (hint) {
                    left = Math.max(left, hint.right - containerRect.left);
                    top = Math.max(top, hint.bottom - containerRect.top);
                }
                if (toolbar) {
                    right = Math.max(right, containerRect.right - toolbar.left);
                    top = Math.max(top, toolbar.bottom - containerRect.top);
                }
                if (minimap) {
                    right = Math.max(right, containerRect.right - minimap.left);
                    bottom = Math.max(bottom, containerRect.bottom - minimap.top);
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

                // visibleElements(cy) (not cy.elements() / all) - Fit Graph
                // (and the initial-view logic below, which also calls this)
                // must fit whatever the area filter currently shows, not
                // the full graph underneath it.
                const currentView = visibleElements(cy);
                const bb = currentView.boundingBox();

                if (bb.w === 0 || bb.h === 0 || availableWidth <= 0 || availableHeight <= 0) {
                    cy.fit(currentView, basePadding);
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
                const currentView = visibleElements(cy);
                const bb = currentView.boundingBox();
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
                    cy.center(currentView);
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
            const MINIMAP_WIDTH = 220;
            const MINIMAP_HEIGHT = 160;
            const MINIMAP_PADDING = 6;

            const minimapCanvas = document.getElementById('minimap-canvas');
            const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

            const minimapStatic = document.createElement('canvas');
            minimapStatic.width = MINIMAP_WIDTH;
            minimapStatic.height = MINIMAP_HEIGHT;
            const minimapStaticCtx = minimapStatic.getContext('2d');

            let minimapTransform = null;

            function computeMinimapTransform(cy) {
                // visibleElements(cy) - the minimap frames whatever the
                // area filter currently shows, not the full graph
                // underneath it.
                const bb = visibleElements(cy).boundingBox();
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
                // visibleEdges(cy) - area-hidden edges have no place on a
                // minimap of the currently filtered view.
                visibleEdges(cy).forEach((edge) => {
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

                visibleNodes(cy).forEach((node) => {
                    const pos = node.position();
                    const point = toMinimapPoint(pos.x, pos.y, transform);

                    minimapStaticCtx.fillStyle = node.hasClass('scc')
                        ? node.data('color') || '#ef4444'
                        : node.data('areaColor') || '#9ca3af';

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
            onLayoutFinished(cy, 'flowVertical');

            const layoutSelect = document.getElementById('layout-select');
            const edgeClarityNote = document.getElementById('edge-clarity-note');

            // Experimental (branch: experiment/cycle-map-v2, area filter).
            // Runs a layout on visibleElements(cy) - not cy.layout(), which
            // would run on the WHOLE graph regardless of the area filter -
            // so switching to e.g. 'core' actually recomputes positions for
            // only core's own nodes/edges, not the full graph with some of
            // it hidden afterward. Shared by the layout dropdown and the
            // area dropdown, since either one changing means "recompute
            // the currently-selected layout for whatever is visible now".
            function runLayoutForCurrentView(layoutName) {
                const isCleanLayout = CLEAN_LAYOUTS.includes(layoutName);
                const runningLayout = visibleElements(cy).layout(layouts[layoutName]);

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
            }

            if (layoutSelect) {
                layoutSelect.addEventListener(
                    'change',
                    function () {
                        runLayoutForCurrentView(this.value);
                    },
                );
            }

            const areaSelect = document.getElementById('area-select');
            const connectionSelect = document.getElementById('connection-select');

            function externalProxyNodeId(area) {
                return 'external-area-proxy::' + area;
            }

            // Experimental (branch: experiment/cycle-map-v2, area filter
            // external connections). One small proxy node per external
            // area the selected area actually has real cross-area edges
            // with - never the real external nodes themselves, so "With
            // external connections" can't balloon a small area's view
            // into pulling in dozens/hundreds of unrelated real nodes from
            // elsewhere (a project with many areas and a densely
            // interconnected one selected could otherwise show nearly the
            // whole graph). One proxy EDGE per real crossing edge (not
            // aggregated/counted into one line) - edges were never the
            // part at risk of exploding (bounded by the graph's own real
            // edge count), so this preserves the real number/direction of
            // crossing dependencies exactly, only collapsing the NODE side
            // of it. Direction is preserved: an edge whose source is the
            // external node becomes proxy->internalNode; whose target is
            // external becomes internalNode->proxy - so "this module
            // depends on area X" and "area X depends on this module"
            // still read differently, exactly like the real edges they
            // stand in for.
            //
            // Pure runtime/presentation additions to the live cy instance,
            // added here and fully removed by removeExternalConnectionProxies
            // below on every area/connection-mode change - nothing about
            // the underlying graph data this report was generated from
            // (the nodes/edges passed into buildHtmlTemplate) is ever
            // touched, read back, or duplicated into a second data model.
            function addExternalConnectionProxies(cy, area) {
                if (!area) {
                    return;
                }

                const proxyAreaColors = new Map();
                const proxyEdges = [];

                cy.edges().forEach((edge) => {
                    if (edge.data('isExternalProxy')) {
                        return;
                    }

                    const sourceInArea = edge.source().data('area') === area;
                    const targetInArea = edge.target().data('area') === area;

                    // Only boundary-crossing edges (exactly one endpoint in
                    // the selected area) need a proxy - both-in edges are
                    // already shown as real edges, both-out edges are
                    // irrelevant to this area's view either way.
                    if (sourceInArea === targetInArea) {
                        return;
                    }

                    const internalNode = sourceInArea ? edge.source() : edge.target();
                    const externalNode = sourceInArea ? edge.target() : edge.source();
                    const externalArea = externalNode.data('area');

                    if (!proxyAreaColors.has(externalArea)) {
                        proxyAreaColors.set(externalArea, externalNode.data('areaColor'));
                    }

                    const proxyId = externalProxyNodeId(externalArea);

                    proxyEdges.push({
                        group: 'edges',
                        data: {
                            id: 'external-proxy-edge::' + edge.id(),
                            source: sourceInArea ? internalNode.id() : proxyId,
                            target: sourceInArea ? proxyId : internalNode.id(),
                            isExternalProxy: true,
                        },
                        classes: 'external-proxy-edge',
                    });
                });

                // Nodes must exist before the edges referencing them are
                // added - two separate cy.add() calls rather than relying
                // on cytoscape resolving mixed node/edge ordering within
                // one array.
                cy.add(
                    Array.from(proxyAreaColors.entries()).map(([externalArea, areaColor]) => ({
                        group: 'nodes',
                        data: {
                            id: externalProxyNodeId(externalArea),
                            label: externalArea,
                            areaColor: areaColor,
                            isExternalProxy: true,
                        },
                        classes: 'external-area-proxy',
                    })),
                );

                cy.add(proxyEdges);
            }

            function removeExternalConnectionProxies(cy) {
                cy.remove('.external-area-proxy, .external-proxy-edge');
            }

            // Experimental (branch: experiment/cycle-map-v2, area filter
            // external connections). Single entry point for both the Area
            // and Connections dropdowns - either one changing means "redo
            // the presentation-level view from scratch": drop any existing
            // proxies, recompute which real nodes/edges are hidden, add
            // fresh proxies if applicable, refresh the legend highlight
            // and the Connections control's enabled state, and clear the
            // selection if it no longer applies. Presentation-level only,
            // same as the original area filter - never removes anything
            // from cy except the proxy elements it added itself, so the
            // full graph (every real node/edge, every cross-area edge)
            // stays completely intact underneath whatever is currently
            // shown.
            function refreshAreaView() {
                removeExternalConnectionProxies(cy);

                cy.batch(() => {
                    cy.nodes().forEach((node) => {
                        node.toggleClass('area-hidden', !isNodeInCurrentView(node));
                    });

                    cy.edges().forEach((edge) => {
                        edge.toggleClass('area-hidden', !isEdgeInCurrentView(edge));
                    });
                });

                if (currentAreaFilter && currentConnectionMode === 'external') {
                    addExternalConnectionProxies(cy, currentAreaFilter);
                }

                updateLegendActiveArea(currentAreaFilter);

                if (connectionSelect) {
                    // Area = 'All' has no "outside" to have external
                    // connections to - both options would show the exact
                    // same full graph, so rather than let the control
                    // silently do nothing, it's disabled whenever 'All' is
                    // selected and re-enabled the moment a specific area
                    // is chosen. currentConnectionMode itself is left
                    // untouched (not reset to 'internal') so the user's
                    // choice is remembered for the next specific area they
                    // pick.
                    connectionSelect.disabled = !currentAreaFilter;
                }

                // A node that was selected before switching areas/modes
                // may no longer be visible (hidden by the new area filter,
                // or a proxy node that just got removed) - leaving its
                // info in the HUD/its '.selected' border would misrepresent
                // a module the user can no longer even see as if it were
                // still part of the current view. cy.getElementById on a
                // removed proxy correctly returns an empty collection, so
                // this same check covers both cases without needing to
                // distinguish them.
                if (selectedNodeId) {
                    const selectedNode = cy.getElementById(selectedNodeId);

                    if (selectedNode.empty() || selectedNode.hasClass('area-hidden')) {
                        selectedNodeId = null;
                        clearHighlights();
                        updateSelectedModulePanel(null);
                    }
                }
            }

            if (areaSelect) {
                areaSelect.addEventListener(
                    'change',
                    function () {
                        currentAreaFilter = this.value || '';
                        refreshAreaView();
                        runLayoutForCurrentView(layoutSelect ? layoutSelect.value : 'flowVertical');
                    },
                );
            }

            if (connectionSelect) {
                connectionSelect.addEventListener(
                    'change',
                    function () {
                        // Defense in depth alongside the 'disabled' attribute
                        // above - Area = 'All' never has a meaningful
                        // connection mode to apply.
                        if (!currentAreaFilter) {
                            return;
                        }

                        currentConnectionMode = this.value;
                        refreshAreaView();
                        runLayoutForCurrentView(layoutSelect ? layoutSelect.value : 'flowVertical');
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

            // Experimental (branch: experiment/cycle-map-v2). Explicit
            // zoom controls, now that the mouse wheel no longer does this
            // (userZoomingEnabled: false above) - +/- zoom around the
            // center of whatever's currently on screen (renderedPosition
            // in screen/container pixels, not a graph-model coordinate),
            // so zooming doesn't yank the viewport toward some arbitrary
            // graph-space origin. The displayed percentage is driven
            // entirely by cy's own 'zoom' event, not by these two button
            // handlers specifically - Fit Graph, the initial-view logic,
            // and any future zoom-triggering code all already go through
            // cy.zoom()/cy.fit(), which fire that event the same way.
            const zoomLevelDisplay = document.getElementById('zoom-level');
            const zoomInButton = document.getElementById('zoom-in-btn');
            const zoomOutButton = document.getElementById('zoom-out-btn');
            const ZOOM_STEP_FACTOR = 1.2;

            function updateZoomLevelDisplay() {
                if (zoomLevelDisplay) {
                    zoomLevelDisplay.textContent = Math.round(cy.zoom() * 100) + '%';
                }
            }

            function stepZoom(factor) {
                const container = cy.container();

                cy.zoom({
                    level: cy.zoom() * factor,
                    renderedPosition: {
                        x: container.clientWidth / 2,
                        y: container.clientHeight / 2,
                    },
                });
            }

            zoomInButton?.addEventListener('click', () => stepZoom(ZOOM_STEP_FACTOR));
            zoomOutButton?.addEventListener('click', () => stepZoom(1 / ZOOM_STEP_FACTOR));

            cy.on('zoom', updateZoomLevelDisplay);
            updateZoomLevelDisplay();

            let selectedNodeId = null;

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

            const hudSelectedBody = document.getElementById('hud-selected-body');

            const HUD_SELECTED_EMPTY_TEXT = 'Click a module to see details.';

            // Bottom HUD's persistent "selected module" panel (center
            // section) - reuses the exact same node.data() fields the old
            // floating tooltip read (label/id/ca/ce/instability/sccSize),
            // just rendered into a fixed panel instead of following the
            // cursor. data.id is the full canonical path (never the
            // abbreviated on-node displayDir) - required so the HUD always
            // shows the complete path regardless of how short the node's
            // own label is.
            function updateSelectedModulePanel(node) {
                if (!hudSelectedBody) {
                    return;
                }

                if (!node) {
                    hudSelectedBody.className = 'hud-selected-empty';
                    hudSelectedBody.textContent = HUD_SELECTED_EMPTY_TEXT;
                    return;
                }

                const data = node.data();
                const title = data.label || data.id;

                hudSelectedBody.className = '';
                hudSelectedBody.innerHTML = \`
                    <strong>\${escapeHtml(title)}</strong><br />
                    <span class="hud-selected-path">\${escapeHtml(data.id)}</span><br />
                    Ca: \${data.ca} &nbsp;&nbsp; Ce: \${data.ce} &nbsp;&nbsp;
                    Instability: \${Number(data.instability).toFixed(2)} &nbsp;&nbsp;
                    SCC size: \${data.sccSize ?? 0}
                \`;
            }

            // Experimental (branch: experiment/cycle-map-v2, area filter
            // external connections). A proxy node isn't a real module - it
            // has no Ca/Ce/instability/canonical path of its own, so it
            // gets its own small, deliberately neutral panel (no
            // "risk"/"violation" language - crossing an area boundary
            // isn't itself a problem) instead of updateSelectedModulePanel
            // above, which would otherwise print "Ca: undefined" etc.
            function updateSelectedAreaProxyPanel(node) {
                if (!hudSelectedBody) {
                    return;
                }

                const data = node.data();
                const connectionCount = node.connectedEdges().length;

                hudSelectedBody.className = '';
                hudSelectedBody.innerHTML = \`
                    <strong>External area: \${escapeHtml(data.label)}</strong><br />
                    <span class="hud-selected-path">Aggregated view of connections between the selected area and \${escapeHtml(data.label)}.</span><br />
                    Connections shown: \${connectionCount}
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
                if (selectedNodeId) {
                    return;
                }

                const node = event.target;

                if (highlightEnabled) {
                    highlightNeighborhood(node);
                }
            });

            cy.on('mouseout', 'node', () => {
                if (selectedNodeId) {
                    return;
                }

                clearHighlights();
            });

            cy.on('tap', 'node', (event) => {
                const node = event.target;
                const data = node.data();

                selectedNodeId = data.id;

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

                if (data.isExternalProxy) {
                    updateSelectedAreaProxyPanel(node);
                } else {
                    updateSelectedModulePanel(node);
                }
            });

            cy.on('tap', (event) => {
                if (event.target === cy) {
                    selectedNodeId = null;

                    clearHighlights();

                    updateSelectedModulePanel(null);
                }
            });
        </script>
    </body>
    </html>
    `;
}
