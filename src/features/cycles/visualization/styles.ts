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

    #hint .legend-swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
        margin-right: 6px;
        vertical-align: middle;
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
`;
