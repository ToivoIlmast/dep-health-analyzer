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
    }

    body {
        margin: 0;
        padding: 0;
        font-family: sans-serif;
    }

    #cy {
        width: 100vw;
        height: calc(100vh - var(--bottom-hud-height));
    }

    #toolbar {
        position: absolute;
        top: 16px;
        right: 16px;

        z-index: 999;

        display: flex;
        align-items: center;
        gap: 10px;

        background: white;

        border: 1px solid #d1d5db;
        border-radius: 8px;

        padding: 10px;
    }

    #toolbar button {
        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 6px;

        background: #f9fafb;

        padding: 6px 10px;
    }

    #toolbar select {
        padding: 6px 10px;
    }

    #zoom-controls {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    #zoom-controls button {
        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 6px;

        background: #f9fafb;

        width: 28px;
        height: 28px;
        line-height: 1;
        font-size: 16px;
    }

    #zoom-level {
        min-width: 44px;
        text-align: center;
        font-size: 13px;
        color: #374151;
    }

    #hint {
        position: absolute;
        top: 16px;
        left: 16px;
        width: 260px;

        padding: 12px 14px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;

        font-size: 13px;
        line-height: 1.5;
        color: #374151;

        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        z-index: 999;
    }

    /* Experimental (branch: experiment/cycle-map-v2, SCC summary). Same
       "quiet secondary block" treatment as .hud-cycle-context - a dashed
       top-adjacent border, not a loud panel of its own, since a detected
       SCC is an observation to investigate, not a warning. */
    #scc-summary {
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px dashed #d1d5db;
    }

    #hint .legend-swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
        margin-right: 6px;
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
        max-width: 280px;

        padding: 8px 12px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;

        font-size: 12px;
        line-height: 1.4;
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
        gap: 12px;

        padding: 4px 16px;

        background: #f3f4f6;
        border-top: 1px solid #d1d5db;

        z-index: 999;
    }

    #hud-help,
    #hud-selected {
        box-sizing: border-box;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        padding: 10px 14px;

        font-size: 13px;
        line-height: 1.5;
        color: #374151;

        overflow-y: auto;
    }

    #hud-help {
        flex: 0 0 220px;
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
        font-size: 12px;
        color: #6b7280;
        word-break: break-all;
    }

    /* Experimental (branch: experiment/cycle-map-v2, cycle node details).
       Only ever present for a node that's actually part of a detected SCC
       (a group of mutually reachable modules, guaranteed to contain at
       least one cycle) - kept visually distinct (a top border, muted
       color) from the always-present Ca/Ce/Instability line above it,
       without using any warning/danger color - a detected SCC/cycle is an
       observation to investigate, not something this report itself flags
       as wrong. */
    .hud-cycle-context {
        display: inline-block;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px dashed #d1d5db;
        font-size: 12px;
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
        margin-top: 4px;

        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 6px;

        background: #f9fafb;
        color: #374151;

        padding: 3px 8px;
        font-size: 11px;
    }

    .hud-focus-scc-btn:hover {
        background: #f3f4f6;
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
        max-width: 520px;
        width: calc(100% - 64px);
        max-height: calc(100vh - 96px);
        overflow-y: auto;
        box-sizing: border-box;

        padding: 20px 24px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);

        font-size: 13px;
        line-height: 1.6;
        color: #374151;
    }

    #cycle-info-modal::backdrop {
        background: rgba(17, 24, 39, 0.35);
    }

    #cycle-info-modal h2 {
        margin: 0 0 12px;
        font-size: 17px;
        color: #111827;
    }

    #cycle-info-modal h3 {
        margin: 18px 0 6px;
        font-size: 14px;
        color: #111827;
    }

    #cycle-info-modal p,
    #cycle-info-modal ul,
    #cycle-info-modal ol {
        margin: 6px 0;
    }

    #cycle-info-modal ul,
    #cycle-info-modal ol {
        padding-left: 20px;
    }

    #cycle-info-modal li {
        margin: 4px 0;
    }

    .cycle-info-example {
        font-family: monospace;
        font-size: 14px;
        background: #f9fafb;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 8px 12px;
        display: inline-block;
    }

    /* Deliberately not red/orange/bold-alarm styling - this sentence is
       the modal's single most important point, but the point itself is
       "this is not a verdict", so the emphasis is typographic only. */
    .cycle-info-emphasis {
        font-weight: 600;
        color: #111827;
    }

    #cycle-info-close-btn {
        margin-top: 16px;

        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 6px;

        background: #f9fafb;

        padding: 6px 14px;
        font-size: 13px;
    }
`;
