export const styles = `
    body {
        margin: 0;
        padding: 0;
        font-family: sans-serif;
    }

    #cy {
        width: 100vw;
        height: 100vh;
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

    #tooltip {
        position: absolute;
        display: none;
        padding: 8px 10px;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 12px;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        white-space: nowrap;
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

    /* Experimental (branch: experiment/cycle-map-v2). The old hover/
       click/Ca/Ce/Instability explanatory block is kept in the HTML
       markup (see the '.pending-hud-reuse' wrapper in template.ts) for a
       future bottom HUD info panel to reuse verbatim - this just hides
       it from the current left panel. A named class rather than an
       inline style so "why is this hidden" is discoverable by name
       instead of looking like a stray leftover. display:none doesn't
       remove anything from the DOM/markup - only the rendering - so
       nothing about the reuse this is meant to enable is at risk. */
    .pending-hud-reuse {
        display: none;
    }

    #edge-clarity-note {
        position: absolute;
        bottom: 16px;
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

    #minimap-container {
        position: absolute;
        bottom: 16px;
        right: 16px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        padding: 4px;

        z-index: 999;
    }

    #minimap-canvas {
        display: block;
        cursor: pointer;
    }
`;
