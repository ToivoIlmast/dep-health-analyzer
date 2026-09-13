export const styles = `
    :root {
        /* Experimental (branch: experiment/cycle-map-v2). Fixed, compact -
           deliberately not a fraction of viewport height - the minimum
           that still fits the existing minimap (220x160 canvas + its own
           4px padding + 1px border = 170px tall) centered inside
           #bottom-hud's 4px top/bottom padding, without touching the
           minimap's own dimensions. Shared by #cy's height and
           #bottom-hud's height so the two can never drift out of sync. */
        --bottom-hud-height: 178px;

        /* Information architecture rework. The one persistent element
           visible in BOTH the Findings and Graph views - everything else
           beneath it is sized relative to this, the same way
           --bottom-hud-height already anchors #cy's own height. */
        --app-header-height: 52px;
    }

    body {
        margin: 0;
        padding: 0;
        font-family: sans-serif;
    }

    /* Information architecture rework. Persistent across both views -
       the Findings/Graph tabs and language switcher live here, fixed to
       the very top so switching views (a CSS-state flip below, not real
       navigation) never has to re-render or reposition this. */
    #app-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: var(--app-header-height);
        box-sizing: border-box;

        display: flex;
        align-items: center;
        gap: 20px;

        padding: 0 20px;

        background: white;
        border-bottom: 1px solid #d1d5db;

        z-index: 2000;
    }

    /* Information architecture rework. #findings-view is normal
       document flow (plain, scrollable page content) - only needs to
       clear the fixed header above it and hide (plain display:none, safe
       here since nothing inside it is a canvas/measurement-sensitive
       library) when the Graph tab is active. */
    #findings-view {
        padding-top: var(--app-header-height);
    }

    #findings-view.is-hidden {
        display: none;
    }

    /* Information architecture rework (previously: normal document flow,
       reached by scrolling). #cy/#hint/#toolbar/#edge-clarity-note (all
       position: absolute with no positioned ancestor of their own, see
       below) resolve relative to THIS wrapper's own box regardless of
       position: fixed vs. relative - switching it to fixed only changes
       where that box itself sits (a full-viewport overlay, below the
       header) and how it's hidden.

       Hidden via visibility, not display:none, so its true pixel
       dimensions are already correct the moment the page loads -
       applyInitialView/fitCyAvoidingChrome (both unchanged) run
       synchronously as part of the very first layout, long before a user
       could click the "Graph" tab, and read container.clientWidth/
       clientHeight to do it; display:none would report zero for both at
       that exact moment and permanently corrupt the initial zoom/pan
       math (there is no later "resize" event to recover from it, since
       nothing about the container's on-screen size actually changes when
       switching tabs - only its visibility does). This also means Graph
       state (zoom, pan, selection, Focus SCC, filters) survives switching
       away and back for free - nothing here ever tears the graph down or
       rebuilds it. */
    #graph-explorer {
        position: fixed;
        top: var(--app-header-height);
        left: 0;
        width: 100vw;
        height: calc(100vh - var(--app-header-height) - var(--bottom-hud-height));
        visibility: hidden;
    }

    #graph-explorer.is-active {
        visibility: visible;
    }

    #cy {
        width: 100%;
        height: 100%;
    }

    #toolbar {
        position: absolute;
        top: 16px;
        right: 16px;
        /* Pre-existing condition (present before this readability pass
           too): #toolbar and #hint are two independently right/left
           anchored boxes with no shared layout container, so a toolbar
           wide enough to need more horizontal room than the viewport has
           free will grow left past #hint's own space (16px + #hint's own
           300px width + a margin of safety). Bigger controls make that
           math easier to hit at common laptop widths - box-sizing plus
           this max-width cap (in terms of the toolbar's own true
           rendered width, border and padding included) plus flex-wrap
           together mean the toolbar wraps onto a second line, still
           right-anchored, before it would ever need to reach as far
           left as #hint's own space. */
        box-sizing: border-box;
        max-width: calc(100vw - 356px);
        flex-wrap: wrap;
        justify-content: flex-end;

        z-index: 999;

        display: flex;
        align-items: center;
        gap: 14px;

        background: white;

        border: 1px solid #d1d5db;
        border-radius: 10px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        padding: 12px 16px;

        font-family: sans-serif;
        font-size: 14.5px;
        color: #374151;
    }

    #toolbar label {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    #toolbar button,
    #toolbar select {
        font-family: sans-serif;
        font-size: 14.5px;
        color: #374151;
    }

    #toolbar button {
        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 7px;

        background: #f9fafb;

        padding: 9px 16px;

        transition: background-color 0.1s ease-in-out, border-color 0.1s ease-in-out;
    }

    #toolbar button:hover {
        background: #f3f4f6;
        border-color: #9ca3af;
    }

    #toolbar select {
        border: 1px solid #d1d5db;
        border-radius: 7px;

        background: white;

        padding: 9px 12px;
    }

    #toolbar button:focus-visible,
    #toolbar select:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
    }

    #zoom-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    #zoom-controls button {
        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 7px;

        background: #f9fafb;

        width: 34px;
        height: 34px;
        line-height: 1;
        font-size: 18px;

        transition: background-color 0.1s ease-in-out, border-color 0.1s ease-in-out;
    }

    #zoom-controls button:hover {
        background: #f3f4f6;
        border-color: #9ca3af;
    }

    #zoom-controls button:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
    }

    #zoom-level {
        min-width: 52px;
        text-align: center;
        font-size: 14.5px;
        color: #374151;
    }

    #hint {
        position: absolute;
        top: 16px;
        left: 16px;
        width: 300px;
        box-sizing: border-box;

        padding: 16px 18px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 10px;

        font-size: 14.5px;
        line-height: 1.6;
        color: #374151;

        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        z-index: 999;
    }

    /* Experimental (branch: experiment/cycle-map-v2, SCC summary). Same
       "quiet secondary block" treatment as .hud-cycle-context - a dashed
       top-adjacent border, not a loud panel of its own, since a detected
       SCC is an observation to investigate, not a warning. */
    #scc-summary {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px dashed #d1d5db;
    }

    #hint .legend-swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
        /* Logical, not physical - #hint now mirrors under dir="rtl" for
           Arabic (full localization task), and a plain margin-right would
           stay pinned to the swatch's physical right side even when the
           row's logical "end" is now the left - the same class of bug
           found and fixed on #view-tabs earlier. */
        margin-inline-end: 6px;
        vertical-align: middle;
    }

    /* Experimental (branch: experiment/cycle-map-v2, area filter). Marks
       whichever legend row matches the currently-selected area - doesn't
       touch the deterministic area->color system itself, just highlights
       which of those already-real colors is active right now. */
    #area-legend [data-area].legend-area-active {
        font-weight: 600;
        color: #111827;
    }

    #edge-clarity-note {
        position: absolute;
        /* Anchored above the fixed bottom HUD (not the raw viewport
           bottom) so it doesn't end up floating inside/behind the HUD
           band now that the minimap moved out of this corner. */
        bottom: calc(var(--bottom-hud-height) + 16px);
        left: 16px;
        max-width: 300px;

        padding: 10px 14px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 9px;

        font-size: 13.5px;
        line-height: 1.5;
        color: #374151;

        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        z-index: 999;
    }

    /* Experimental (branch: experiment/cycle-map-v2). Bottom HUD - fixed
       to the viewport (not the graph's world coordinates), so it never
       moves on pan/zoom/scroll and never grows page height. Three
       sections in one row: help/metrics legend, selected-module info,
       and the existing minimap (moved in here via layout only - its own
       canvas/draw/drag logic, below in the script, is untouched). */
    #bottom-hud {
        position: fixed;
        bottom: 0;
        left: 0;

        width: 100vw;
        height: var(--bottom-hud-height);
        box-sizing: border-box;

        display: flex;
        align-items: stretch;
        gap: 16px;

        /* Vertical padding stays 4px - it's part of the exact
           --bottom-hud-height math documented above (minimap-container's
           own fixed 170px = canvas 160px + its 4px padding*2 + 1px
           border*2), so it can't grow without either shrinking the
           minimap's clearance or requiring --bottom-hud-height to grow
           with it. Horizontal padding has no such constraint. */
        padding: 4px 20px;

        background: #f3f4f6;
        border-top: 1px solid #d1d5db;

        z-index: 999;

        /* Information architecture rework. Toggled together with
           #graph-explorer (same switchToView() call) - visibility, not
           display:none, for the same reason: the minimap canvas inside
           this lives at a fixed pixel size that's already measured and
           drawn once at load (see redrawMinimapStatic below), and a
           hidden-via-display container would report zero for its own
           measurements too. */
        visibility: hidden;
    }

    #bottom-hud.is-active {
        visibility: visible;
    }

    #hud-help,
    #hud-selected {
        box-sizing: border-box;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 9px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        padding: 14px 18px;

        font-size: 14.5px;
        line-height: 1.6;
        color: #374151;

        overflow-y: auto;
    }

    #hud-help {
        flex: 0 0 240px;
    }

    #hud-selected {
        flex: 1 1 auto;
        min-width: 0;
    }

    .hud-selected-empty {
        color: #9ca3af;
    }

    .hud-selected-path {
        display: inline-block;
        margin: 2px 0 4px;
        font-size: 13.5px;
        color: #6b7280;
        word-break: break-all;
    }

    /* Experimental (branch: experiment/cycle-map-v2, cycle node details).
       Only ever present for a node that's actually part of a detected SCC
       (a group of mutually reachable modules, guaranteed to contain at
       least one cycle) - kept visually distinct (a top border, muted
       color) from the module title/path lines above it, without using any
       warning/danger color - a detected SCC/cycle is an observation to
       investigate, not something this report itself flags as wrong. */
    .hud-cycle-context {
        display: inline-block;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #d1d5db;
        font-size: 13px;
        color: #6b7280;
    }

    /* Experimental (branch: experiment/cycle-map-v2, SCC member
       navigation). A dotted underline (not a solid one, not a button) -
       reads as "clickable text" using the report's existing visual
       language (matches the minimap viewport rectangle's blue,
       #2563eb - already this report's one existing "interactive/
       navigable" color) without turning the HUD into a row of buttons. */
    .hud-scc-member {
        cursor: pointer;
        color: #2563eb;
        text-decoration: underline;
        text-decoration-style: dotted;
        text-underline-offset: 2px;
    }

    .hud-scc-member:hover {
        text-decoration-style: solid;
    }

    /* A member currently hidden by the Area/Connections filter - plain,
       muted, explicitly non-interactive (no cursor/underline) rather than
       a dead-looking link or a silently-failing click target. */
    .hud-scc-member-hidden {
        color: #9ca3af;
        font-style: italic;
    }

    /* Experimental (branch: experiment/cycle-map-v2, SCC focus). Matches
       #toolbar button's own look (same border/radius/background) so it
       reads as "a real action", not just more link-like text next to the
       member names above it - but smaller, since it lives inline inside a
       compact HUD panel rather than the toolbar itself. */
    .hud-focus-scc-btn {
        display: inline-block;
        margin-top: 6px;

        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 7px;

        background: #f9fafb;
        color: #374151;

        padding: 6px 12px;
        font-size: 13px;

        transition: background-color 0.1s ease-in-out;
    }

    .hud-focus-scc-btn:hover {
        background: #f3f4f6;
    }

    .hud-focus-scc-btn:focus-visible,
    .hud-cycle-detail-btn:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
    }

    /* Experimental (branch: experiment/cycle-map-v2, concrete dependency
       cycle). Same size/shape as .hud-focus-scc-btn (still "a real
       action" living in the same compact HUD row), but outlined in this
       report's one existing "interactive/navigable" blue (matches
       .hud-scc-member's link color and the minimap viewport rectangle) -
       a light visual cue that the two buttons open different kinds of
       views (a viewport move vs. a modal), without introducing a new,
       heavier "primary button" look nothing else in this report uses. */
    .hud-cycle-detail-btn {
        display: inline-block;
        margin-top: 6px;

        cursor: pointer;

        border: 1px solid #2563eb;
        border-radius: 7px;

        background: white;
        color: #2563eb;

        padding: 6px 12px;
        font-size: 13px;

        transition: background-color 0.1s ease-in-out;
    }

    .hud-cycle-detail-btn:hover {
        background: #eff6ff;
    }

    /* Same dialog chrome as #cycle-info-modal above, restated for this
       second dialog rather than sharing a selector with it - each dialog
       id needs its own <dialog> element/backdrop pairing regardless, and
       keeping the two independent avoids specificity fights between this
       modal's own component classes (.cycle-detail-list,
       .cycle-detail-hidden-note, ...) and any generic p/ol/li rule that
       sharing #cycle-info-modal's selectors would otherwise also apply
       here. Slightly wider than #cycle-info-modal - the flow diagram
       below reads better with a bit more room before its rows wrap. */
    #cycle-detail-modal {
        max-width: 680px;
        width: calc(100% - 64px);
        max-height: calc(100vh - 96px);
        overflow-y: auto;
        box-sizing: border-box;

        padding: 26px 30px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);

        font-size: 14.5px;
        line-height: 1.65;
        color: #374151;
    }

    #cycle-detail-modal::backdrop {
        background: rgba(17, 24, 39, 0.35);
    }

    /* UI polish (branch: experiment/cycle-map-v2, no behavior change): the
       title now shares a row with a small module-count badge, so the
       header itself communicates "this is about a 7-module cycle" before
       reading a single word of body text. */
    .cycle-detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        margin: 0 0 14px;
    }

    #cycle-detail-modal h2 {
        margin: 0;
        font-size: 20px;
        color: #111827;
    }

    .cycle-count-badge {
        flex: 0 0 auto;

        border: 1px solid #bfdbfe;
        border-radius: 999px;

        background: #eff6ff;
        color: #1d4ed8;

        padding: 4px 12px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
    }

    #cycle-detail-body h3 {
        margin: 20px 0 8px;
        font-size: 16px;
        color: #111827;
    }

    /* One short, concrete sentence (never the long "this SCC contains
       cycles..." paragraph the HUD's own SCC context already carries) -
       the "may contain others" caveat that keeps this from ever reading
       as "the cycle" moves to its own quiet .cycle-detail-note line
       instead of being folded into the same sentence. */
    .cycle-detail-subtitle {
        margin: 0 0 3px;
        font-size: 15px;
        color: #1f2937;
    }

    .cycle-detail-note {
        margin: 0 0 14px;
        font-size: 13px;
        color: #9ca3af;
    }

    /* Findings-first navigation. The same conceptual action as the HUD's
       own .hud-focus-scc-btn (both call the unchanged focusScc()), styled
       to match it - a plain bordered "real action" button, not a heavier
       primary-CTA look - just sized for this modal's own larger type scale
       rather than the compact HUD row's. */
    .cycle-detail-focus-btn {
        display: inline-block;
        margin: 4px 0 16px;

        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 7px;

        background: #f9fafb;
        color: #374151;

        padding: 8px 16px;
        font-size: 14px;

        transition: background-color 0.1s ease-in-out;
    }

    .cycle-detail-focus-btn:hover {
        background: #f3f4f6;
    }

    .cycle-detail-focus-btn:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
    }

    .cycle-detail-metadata {
        display: flex;
        gap: 8px;

        margin: 0 0 16px;
    }

    .cycle-meta-chip {
        border: 1px solid #e5e7eb;
        border-radius: 6px;

        background: #f9fafb;
        color: #6b7280;

        padding: 4px 11px;
        font-size: 12.5px;
    }

    /* Experimental (branch: experiment/cycle-map-v2, concrete dependency
       cycle). Rows of up to CYCLE_FLOW_ROW_SIZE chips, stacked - the
       boustrophedon ("snake") arrangement built in buildCycleFlowHtml
       above (row 0 left-to-right, row 1 right-to-left, ...) is what turns
       this from "one long wrapped line of tags" into something that reads
       like a small flow diagram, closer to the main graph's own visual
       language than a tag list is. */
    .cycle-flow {
        display: flex;
        flex-direction: column;
        gap: 2px;

        margin: 4px 0 10px;
        padding: 14px;

        background: #fafafa;
        border: 1px solid #eef0f2;
        border-radius: 10px;
    }

    .cycle-flow-row {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: 6px;
    }

    /* A short vertical connector between two rows, aligned under
       whichever edge the row above actually finished reading from -
       .cycle-flow-connector-right sits at that row's right end (it read
       left-to-right), .cycle-flow-connector-left at its left end (it read
       right-to-left) - so the connector visually continues the same
       reading path rather than floating in an arbitrary spot. */
    .cycle-flow-connector {
        display: flex;
        padding: 0 14px;
    }

    .cycle-flow-connector-right {
        justify-content: flex-end;
    }

    .cycle-flow-connector-left {
        justify-content: flex-start;
    }

    /* The line that calls out the loop-closing edge explicitly, rather
       than one more chip awkwardly appended in whatever direction the
       last row happens to be reading - simpler to get right for any
       cycle length, and reuses .cycle-node-start's own accent color so it
       visually ties back to the highlighted chip at the top of the flow. */
    .cycle-flow-closing {
        margin: 4px 0 12px;

        font-size: 13px;
        color: #6b7280;
    }

    .cycle-chip {
        display: inline-flex;
        align-items: center;

        border: 1px solid #d1d5db;
        border-radius: 8px;

        background: white;
        color: #111827;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

        padding: 8px 13px;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
    }

    /* Same muted treatment as .hud-scc-member-hidden, applied to a chip
       instead of inline text. */
    .cycle-chip-hidden {
        border-style: dashed;
        background: #fafafa;
        color: #9ca3af;
        font-style: italic;
        box-shadow: none;
    }

    /* The selected/start module - the one thing the whole modal is
       "through" - gets the report's one existing interactive blue rather
       than extra text explaining which chip it is. Reused verbatim (same
       class) on the closing line's repeated chip and on the matching
       first row of the list below, so all three read as the same module. */
    .cycle-node-start {
        border-color: #93c5fd;
        background: #eff6ff;
        color: #1d4ed8;
        font-weight: 600;
    }

    .cycle-arrow {
        color: #9ca3af;
        font-size: 17px;
        line-height: 1;
    }

    .cycle-ellipsis {
        color: #6b7280;
        font-size: 13px;
        font-style: italic;
        padding: 0 4px;
    }

    /* Restyled as a calm info strip, not a warning - a hidden cycle
       member is an artifact of the current Area/Connections filter, never
       something wrong with the graph itself, so this deliberately reuses
       the same blue as .cycle-count-badge/.cycle-node-start rather than
       any red/amber "alert" color. */
    .cycle-detail-hidden-note {
        margin: 0 0 12px;
        padding: 10px 12px;

        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 7px;

        font-size: 13px;
        color: #1e40af;
    }

    /* Scrollable, never truncated (see buildCycleListHtml) - a 150-module
       cycle must stay fully listed, just not all visible at once without
       scrolling. */
    .cycle-detail-list {
        max-height: 240px;
        overflow-y: auto;

        margin: 6px 0 0;
        /* Logical - #cycle-detail-modal now mirrors under dir="rtl". */
        padding-inline-start: 0;

        list-style: none;
    }

    .cycle-detail-item {
        display: flex;
        align-items: center;
        gap: 12px;

        padding: 10px 6px;
        border-bottom: 1px solid #f3f4f6;

        font-size: 14.5px;
    }

    .cycle-detail-item:not(.cycle-detail-item-hidden) {
        cursor: pointer;
    }

    .cycle-detail-item:not(.cycle-detail-item-hidden):hover {
        background: #f9fafb;
    }

    /* The selected/start item - same accent family as .cycle-node-start,
       just toned down for a list row (a left accent bar instead of a full
       chip fill, so it doesn't compete with the flow diagram above for
       attention). */
    .cycle-detail-item-start {
        background: #f8fafc;
        /* Logical - #cycle-detail-modal now mirrors under dir="rtl", so
           the accent bar belongs on the row's logical start edge (right
           in RTL), not always the physical left. */
        border-inline-start: 3px solid #93c5fd;
        padding-inline-start: 7px;
        border-radius: 4px;
    }

    .cycle-detail-index {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;

        width: 24px;
        height: 24px;

        border-radius: 50%;
        background: #f3f4f6;

        color: #6b7280;
        font-size: 12px;
        font-weight: 600;
    }

    .cycle-detail-item-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .cycle-detail-item-main strong {
        font-size: 15px;
        color: #111827;
    }

    /* A trailing chevron affordance for a clickable item - hidden until
       hover, rather than a permanent icon competing with the module name
       on every row, matching this report's existing restrained style
       (e.g. .hud-scc-member's underline only strengthens on hover too). */
    .cycle-detail-item-arrow {
        flex: 0 0 auto;
        /* Logical - #cycle-detail-modal now mirrors under dir="rtl". */
        margin-inline-start: auto;

        color: #2563eb;
        font-size: 16px;

        opacity: 0;
        transition: opacity 0.1s ease-in-out;
    }

    .cycle-detail-item:hover .cycle-detail-item-arrow {
        opacity: 1;
    }

    #minimap-container {
        flex: 0 0 auto;
        align-self: center;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        padding: 4px;
    }

    #minimap-canvas {
        display: block;
        cursor: pointer;
    }

    /* Experimental (branch: experiment/cycle-map-v2, educational modal).
       A native <dialog> - the browser supplies the modal semantics
       (::backdrop, ESC-to-close, focus trapping); this only restyles it to
       match the report's own existing visual language (white background,
       subtle border, existing radius/shadow/typography - the same tokens
       #hint/#edge-clarity-note already use) instead of the UA default
       dialog chrome. */
    #cycle-info-modal {
        max-width: 560px;
        width: calc(100% - 64px);
        max-height: calc(100vh - 96px);
        overflow-y: auto;
        box-sizing: border-box;

        padding: 26px 30px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);

        font-size: 14.5px;
        line-height: 1.65;
        color: #374151;
    }

    #cycle-info-modal::backdrop {
        background: rgba(17, 24, 39, 0.35);
    }

    #cycle-info-modal h2 {
        margin: 0 0 14px;
        font-size: 20px;
        color: #111827;
    }

    #cycle-info-modal h3 {
        margin: 20px 0 8px;
        font-size: 16px;
        color: #111827;
    }

    #cycle-info-modal p,
    #cycle-info-modal ul,
    #cycle-info-modal ol {
        margin: 6px 0;
    }

    #cycle-info-modal ul,
    #cycle-info-modal ol {
        /* Logical - #cycle-info-modal now mirrors under dir="rtl". */
        padding-inline-start: 20px;
    }

    #cycle-info-modal li {
        margin: 4px 0;
    }

    .cycle-info-example {
        font-family: monospace;
        font-size: 16px;
        background: #f9fafb;
        border: 1px solid #d1d5db;
        border-radius: 7px;
        padding: 10px 14px;
        display: inline-block;
    }

    /* Deliberately not red/orange/bold-alarm styling - this sentence is
       the modal's single most important point, but the point itself is
       "this is not a verdict", so the emphasis is typographic only. */
    .cycle-info-emphasis {
        font-weight: 600;
        color: #111827;
    }

    #cycle-info-close-btn,
    #cycle-detail-close-btn {
        margin-top: 18px;

        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 7px;

        background: #f9fafb;
        color: #374151;

        padding: 9px 20px;
        font-size: 14.5px;

        transition: background-color 0.1s ease-in-out, border-color 0.1s ease-in-out;
    }

    #cycle-info-close-btn:hover,
    #cycle-detail-close-btn:hover {
        background: #f3f4f6;
        border-color: #9ca3af;
    }

    #cycle-info-close-btn:focus-visible,
    #cycle-detail-close-btn:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
    }

    /* The report's actual first screen - "what is this, how big is the
       project, is anything here worth attention" - a normal, scrollable
       utility-dashboard page rather than a small technical list. Plain
       document flow, not another absolutely-positioned floating panel
       like #hint/#toolbar. Reuses this report's own existing color
       vocabulary (the same grays as #hint's own captions, the same
       interactive blue .cycle-node-start/.cycle-count-badge already use
       elsewhere) rather than introducing a second visual language. */
    .findings-lang-block {
        max-width: 760px;
        margin: 0 auto;
        padding: 48px 32px 64px;

        font-family: sans-serif;
        color: #374151;
    }

    .findings-header {
        margin: 0 0 36px;
    }

    .findings-header h1 {
        margin: 0 0 8px;
        font-size: 28px;
        font-weight: 700;
        line-height: 1.25;
        color: #111827;
    }

    .findings-cycles-section h2 {
        margin: 0 0 6px;
        font-size: 18px;
        font-weight: 600;
        color: #111827;
    }

    .findings-scale {
        margin: 0;
        font-size: 15px;
        color: #6b7280;
    }

    .findings-caveat {
        margin: 0 0 20px;
        font-size: 13px;
        color: #6b7280;
    }

    .findings-zero-card {
        margin-top: 20px;
        padding: 32px;

        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;

        background: #f9fafb;
        border: 1px solid #d1d5db;
        border-radius: 12px;
    }

    .findings-zero-state {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: #111827;
    }

    .findings-list {
        display: flex;
        flex-direction: column;
        gap: 12px;

        margin: 0 0 28px;
        padding: 0;

        list-style: none;
    }

    /* A real card, not a dense list row: the whole card stays clickable
       (matches this report's existing "clickable row" affordance
       language, e.g. .cycle-detail-item) alongside its own explicit
       "View cycle" primary action - either one opens the same modal via
       the same data-finding-scc-id, so neither is "the real way" and the
       other decorative. */
    .finding-row {
        cursor: pointer;

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;

        padding: 20px 24px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

        transition: border-color 0.1s ease-in-out, box-shadow 0.1s ease-in-out;
    }

    .finding-row:hover,
    .finding-row:focus-within {
        border-color: #93c5fd;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
    }

    .finding-row-main {
        min-width: 0;
    }

    .finding-row-header {
        font-size: 15.5px;
        font-weight: 600;
        color: #111827;
    }

    .finding-cycle-preview {
        margin-top: 6px;

        font-family: ui-monospace, monospace;
        font-size: 13px;
        color: #1d4ed8;

        overflow-x: auto;
        white-space: nowrap;
    }

    /* Generic primary/secondary button pair, reused by every new control
       this task adds (Findings' own explore/view-cycle actions, the
       concrete-cycle modal's "Show in graph") - not applied to the
       Graph's own pre-existing toolbar controls, which keep their
       existing look untouched per this task's scope. */
    .btn-primary,
    .btn-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        cursor: pointer;

        border-radius: 8px;

        padding: 10px 18px;
        font-family: sans-serif;
        font-size: 14px;
        font-weight: 600;

        transition: background-color 0.1s ease-in-out, border-color 0.1s ease-in-out;
    }

    .btn-primary {
        border: 1px solid #2563eb;
        background: #2563eb;
        color: white;
    }

    .btn-primary:hover {
        background: #1d4ed8;
        border-color: #1d4ed8;
    }

    .btn-secondary {
        border: 1px solid #2563eb;
        background: white;
        color: #2563eb;
    }

    .btn-secondary:hover {
        background: #eff6ff;
    }

    .btn-primary:focus-visible,
    .btn-secondary:focus-visible,
    .view-tab:focus-visible,
    .finding-row:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
    }

    .finding-view-cycle-btn {
        flex: 0 0 auto;
        padding: 8px 16px;
        font-size: 13px;
    }

    .findings-explore-btn {
        margin-top: 4px;
    }

    /* --- App header (Findings/Graph tabs + language switcher) -------- */

    #app-header-title {
        font-family: sans-serif;
        font-size: 16px;
        font-weight: 700;
        color: #111827;

        white-space: nowrap;
    }

    #view-tabs {
        display: flex;
        gap: 6px;

        /* Logical, not physical - a plain margin-left would stay
           anchored to the physical left edge even under #app-header's
           own dir="rtl" (set for Arabic), splitting the tabs away from
           the language switcher instead of keeping both grouped at the
           "end" edge the way the title/tabs/switcher visually mirror
           for every other RTL-aware part of the header. Confirmed via
           headless Chrome: margin-left: auto left the switcher pinned to
           the physical left edge while flex's own RTL reversal moved the
           tabs elsewhere, tearing the group apart. */
        margin-inline-start: auto;
    }

    .view-tab {
        cursor: pointer;

        border: 1px solid transparent;
        border-radius: 7px;

        background: transparent;
        color: #6b7280;

        padding: 8px 18px;
        font-family: sans-serif;
        font-size: 14.5px;
        font-weight: 600;

        transition: background-color 0.1s ease-in-out, color 0.1s ease-in-out;
    }

    .view-tab:hover {
        background: #f3f4f6;
        color: #111827;
    }

    .view-tab.is-active {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1d4ed8;
    }

    #language-switcher {
        display: flex;
        align-items: center;
        gap: 8px;

        font-family: sans-serif;
        font-size: 13.5px;
        color: #6b7280;
    }

    #language-select {
        border: 1px solid #d1d5db;
        border-radius: 6px;

        background: white;
        color: #374151;

        padding: 6px 10px;
        font-size: 13.5px;
    }

    #language-select:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
    }
`;
