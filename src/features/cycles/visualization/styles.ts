export const styles = `
    html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        font-family: sans-serif;
        /* Experimental (branch: experiment/cycle-map-v2, HUD layer). The
           graph's own pan/zoom is handled entirely inside cytoscape's
           canvas (cy.pan()/cy.zoom()), never by scrolling the document -
           if the page itself is ever able to scroll (any layout quirk that
           makes documentElement taller/wider than the viewport), every
           'position: fixed' overlay below still stays viewport-anchored,
           but this removes the scrollable state itself at the root rather
           than only patching its symptom.
        */
        overflow: hidden;
    }

    /* Experimental (branch: experiment/cycle-map-v2, HUD layer). Leaves
       exactly '#hud's own height at the bottom of the viewport for the
       graph canvas - HUD_HEIGHT here must match #hud's height below (kept
       as one hardcoded number in both places; nothing at runtime reads
       this back into JS, since cy.container().clientHeight already
       reflects whatever this resolves to).
    */
    #cy {
        width: 100vw;
        height: calc(100vh - 160px);
    }

    #toolbar {
        position: fixed;
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

    #tooltip {
        position: fixed;
        display: none;
        padding: 8px 10px;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 12px;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        white-space: nowrap;
        /* Above #hud (999) - the tooltip can appear anywhere the cursor is,
           including right over the bottom HUD strip near the top of the
           graph canvas, and must never render underneath it. */
        z-index: 1000;
    }

    #edge-clarity-note {
        position: fixed;
        bottom: 176px;
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

    /* Experimental (branch: experiment/cycle-map-v2, HUD layer). The
       persistent bottom information/navigation panel - 'position: fixed'
       (not absolute, and not part of the graph canvas) so it stays put
       regardless of pan/zoom/scroll, per the same reasoning as #toolbar/
       #tooltip above. Deliberately a plain 3-column flex row rather than
       a component system: this is the first vertical slice of what's
       meant to grow into a fuller HUD later (per the task this shipped
       under), and a flex row is exactly as much structure as that needs
       right now - anything fancier would be built ahead of an actual
       second requirement for it.
    */
    #hud {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: 160px;

        display: flex;
        align-items: stretch;

        background: white;
        border-top: 1px solid #d1d5db;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.06);

        z-index: 999;

        font-size: 12px;
        color: #374151;
    }

    #hud > div {
        box-sizing: border-box;
        padding: 10px 16px;
        overflow: auto;
    }

    #hud-legend {
        flex: 0 0 240px;
        border-right: 1px solid #e5e7eb;
    }

    #hud-selected {
        flex: 1 1 auto;
        min-width: 0;
        border-right: 1px solid #e5e7eb;
    }

    #hud-minimap {
        flex: 0 0 230px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .hud-section-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #9ca3af;
        margin-bottom: 6px;
    }

    .hud-legend-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 10px;
        margin-bottom: 6px;
        line-height: 1.3;
    }

    .legend-swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
        margin-right: 6px;
        vertical-align: middle;
    }

    .hud-highlight-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    #hud-selected-content .hud-empty {
        color: #9ca3af;
        font-style: italic;
    }

    #hud-selected-content .hud-module-name {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
    }

    #hud-selected-content .hud-module-path {
        font-size: 11px;
        color: #6b7280;
        margin-bottom: 8px;
        word-break: break-all;
    }

    #hud-selected-content .hud-cycle-badge {
        display: inline-block;
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        margin-bottom: 8px;
    }

    #hud-selected-content .hud-stats {
        display: flex;
        gap: 22px;
        flex-wrap: wrap;
    }

    #hud-selected-content .hud-stat-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: #9ca3af;
    }

    #hud-selected-content .hud-stat-value {
        font-size: 15px;
        font-weight: 600;
        color: #111827;
    }

    #minimap-canvas {
        display: block;
        cursor: pointer;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
    }
`;
