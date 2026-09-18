import path from 'node:path';
import type { UnresolvedImport } from '@core/graph/types';
import { CytoscapeEdge, CytoscapeNode } from '../adapters';
import { CycleFindings, SccFinding } from '../findings/buildCycleFindings';
import { Dictionary, I18N, LanguageCode, RTL_LANGUAGES, SUPPORTED_LANGUAGES, formatI18n } from './i18n';
import { escapeHtml } from '@shared/escapeHtml';
import { safeJsonForScript } from '@shared/safeJsonForScript';
import { selectFocusNeighbours } from './focusNeighbourSelection';
import {
    closestPointOnSegment,
    computeEdgePathSegments,
    edgeNodeOverlapIterationsFor,
    nodeOverlapIterationsFor,
    resolveEdgeNodeOverlaps as resolveEdgeNodeOverlapsPure,
    resolveNodeOverlaps as resolveNodeOverlapsPure,
    segmentIntersectsRect,
} from './graphOverlapResolution';
import { styles } from './styles';

type BuildHtmlTemplate = {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
    findings: CycleFindings;
    // Optional (F1): a project with no unresolved imports - the common
    // case, and every pre-existing caller/test - has nothing to show here.
    unresolvedImports?: UnresolvedImport[];
};

// Server-rendered for the initial (English, or whatever getInitialLanguage()
// resolves to before the client script runs) paint - the exact same wording
// renderSccSummary() used to compute client-side from cy.nodes()'s
// sccId/sccSize attributes, now read directly from the real
// Kosaraju-derived findings payload instead. "No dependency SCCs detected"
// rather than a fabricated "0 cycles" - SCC count is not cycle count (a
// single SCC can contain more than one cycle), the same terminology
// distinction already established elsewhere in this report. #scc-summary
// lives inside the Graph view (not a per-language .findings-lang-block, of
// which there are 14), so unlike Findings this text is re-rendered
// client-side on language change - see renderGraphScaleTexts() in the
// script below, which reads the same raw counts back out of
// GRAPH_SCC_SUMMARY_COUNTS.
function renderSccSummaryText(findings: CycleFindings, dict: Dictionary): string {
    if (findings.sccs.length === 0) {
        return dict.noDependencySccsDetected;
    }

    const largestSize = Math.max(...findings.sccs.map((scc) => scc.size));

    return formatI18n(dict.detectedSccsSummary, { n: findings.sccs.length, largest: largestSize });
}

// Findings-first overview (Phase 1). A one-line, presentation-only preview
// of a finding's exampleCycle - never the full thing (that's what the
// concrete-cycle modal, unchanged, is for). Past MAX_INLINE_CYCLE_MEMBERS
// this deliberately collapses to just the start, its first hop, and the
// closing return - not a proportional "first N / last N" abbreviation like
// the modal's own buildCycleFlowCells() - since this list's whole point is
// staying scannable at a glance for potentially several findings at once,
// not being a second place to read a cycle in full. escapeHtml() is
// required here, unlike the modal's client-side escapeHtml(): this runs in
// Node at report-generation time, so nothing sanitizes these values later -
// a crafted file/directory name is exactly as real an XSS vector here as
// anywhere else user-controlled text reaches this report. Module/file
// names are identifiers, not prose - never translated, so this one
// function is shared unchanged across all three rendered language blocks.
const MAX_INLINE_CYCLE_MEMBERS = 4;

function summarizeExampleCycle(exampleCycle: string[]): string {
    const labels = exampleCycle.map((id) => escapeHtml(path.basename(id)));
    const memberCount = labels.length - 1; // exampleCycle repeats the start at both ends

    if (memberCount <= MAX_INLINE_CYCLE_MEMBERS) {
        return labels.join(' &rarr; ');
    }

    return `${labels[0]} &rarr; ${labels[1]} &rarr; &hellip; &rarr; ${labels[0]}`;
}

// One finding = one non-trivial SCC, never "a cycle" - matches the same
// distinction the concrete-cycle modal already draws (SCC #N, size, vs.
// "one concrete cycle through X"). data-finding-scc-id carries the real
// sccId the click wiring below (openCycleDetailModalForScc) reads
// directly - never re-derived by module name. "View cycle" is this card's
// one explicit primary action; the card itself stays clickable too
// (event delegation on #findings-view handles both).
function renderSccFindingRow(finding: SccFinding, dict: Dictionary): string {
    const label = formatI18n(dict.sccLabel, { id: finding.id + 1, n: finding.size });

    return `
                    <li class="finding-row" data-finding-scc-id="${finding.id}">
                        <div class="finding-row-main">
                            <div class="finding-row-header">${label}</div>
                            <div class="finding-cycle-preview">${summarizeExampleCycle(finding.exampleCycle)}</div>
                        </div>
                        <button type="button" class="btn-secondary finding-view-cycle-btn">${escapeHtml(dict.viewCycleButton)}</button>
                    </li>`;
}

function renderScaleText(dict: Dictionary, moduleCount: number, dependencyCount: number): string {
    const modulesText = formatI18n(moduleCount === 1 ? dict.scaleModulesSingular : dict.scaleModules, {
        n: moduleCount,
    });
    const dependenciesText = formatI18n(
        dependencyCount === 1 ? dict.scaleDependenciesSingular : dict.scaleDependencies,
        { n: dependencyCount }
    );

    return `${modulesText} · ${dependenciesText}`;
}

// The very first thing a reader sees - "what is this report, how big is
// the project, is there anything here worth looking at" - before the graph
// itself, which stays exactly as capable as before, just no longer the
// mandatory first screen. Entirely server-rendered from the same
// CycleFindings payload #scc-summary already uses - this section needs
// nothing from the client script or the graph libraries to render
// correctly, including in a copy of this report missing its assets/
// directory.
//
// Deliberately never claims a shown exampleCycle is the only cycle in its
// SCC - the caveat line above the list states this once, for the whole
// list, rather than repeating a caveat on every row (this list's own goal
// is staying scannable, not re-explaining SCC-vs-cycle semantics per
// finding - that explanation already lives in the concrete-cycle modal and
// the "What are dependency cycles?" educational modal, both unchanged).
//
// Rendered once per supported language (see buildHtmlTemplate below) -
// all fourteen sit in the page from the start, only one ever visible
// (data-lang matching the active language; the rest carry a plain
// `hidden` attribute) - never a single English render re-templated by
// client JS on language change. This keeps every language's Findings
// content exactly as real-server-rendered-and-standalone as the English
// default already was, rather than making translated text depend on the
// client script successfully re-running a second, parallel template
// implementation.
//
// Arabic (the one entry in RTL_LANGUAGES) gets its own block's dir="rtl"
// baked in right here, server-side, rather than toggled by client JS -
// it's simply always correct for that one block regardless of which
// language is currently visible, the same reasoning already applied to
// pre-rendering every language's text instead of re-templating it. This
// is scoped to exactly this wrapper: it never touches <html>/<body> or
// #graph-explorer/#bottom-hud, so the Graph view (and the dependency
// graph's own edge direction within it) stays unaffected regardless of
// the selected language - see applyLanguage() in the script below for
// the header's own matching (client-side, since there's only one header,
// not one per language) dir toggle.
function renderFindingsOverview(findings: CycleFindings, lang: LanguageCode): string {
    const dict = I18N[lang];
    const scaleText = renderScaleText(dict, findings.moduleCount, findings.dependencyCount);
    const hiddenAttr = lang === SUPPORTED_LANGUAGES[0] ? '' : ' hidden';
    const dirAttr = RTL_LANGUAGES.has(lang) ? ' dir="rtl"' : '';

    if (findings.sccs.length === 0) {
        return `
            <div class="findings-lang-block" data-lang="${lang}"${hiddenAttr}${dirAttr}>
                <header class="findings-header">
                    <h1>${escapeHtml(dict.findingsTitle)}</h1>
                    <p class="findings-scale">${scaleText}</p>
                </header>

                <div class="findings-zero-card">
                    <p class="findings-zero-state">${escapeHtml(dict.findingsZeroState)}</p>
                    <button type="button" class="btn-primary findings-explore-btn" data-action="explore-graph">${escapeHtml(dict.exploreGraphZero)}</button>
                </div>
            </div>`;
    }

    const caveatText =
        findings.sccs.length === 1
            ? dict.findingsCaveatSingular
            : formatI18n(dict.findingsCaveatPlural, { n: findings.sccs.length });
    // P1-3 fix: display order only - findings are shown biggest-first (the
    // most architecturally significant cycle first), never in
    // findSCCs()/buildCycleFindings' own insertion order, which is just
    // whatever order Kosaraju's DFS happened to visit components in and
    // carries no meaning for a reader. Sorted on a COPY: finding.id (a
    // real node's data.sccId - see buildCycleFindings.ts's own comment on
    // why that must never be reassigned) always stays the original
    // findSCCs() index, completely unaffected by this presentation order.
    // Tie-break by id ascending keeps equal-size findings in a fixed,
    // deterministic order across runs/renders instead of depending on
    // Array.prototype.sort's stability guarantees alone being obvious to a
    // future reader.
    const sortedForDisplay = [...findings.sccs].sort((a, b) => b.size - a.size || a.id - b.id);
    const rowsHtml = sortedForDisplay.map((finding) => renderSccFindingRow(finding, dict)).join('');

    return `
            <div class="findings-lang-block" data-lang="${lang}"${hiddenAttr}${dirAttr}>
                <header class="findings-header">
                    <h1>${escapeHtml(dict.findingsTitle)}</h1>
                    <p class="findings-scale">${scaleText}</p>
                </header>

                <section class="findings-cycles-section">
                    <h2>${escapeHtml(dict.findingsCyclesHeading)}</h2>
                    <p class="findings-caveat">${escapeHtml(caveatText)}</p>

                    <ol class="findings-list">${rowsHtml}
                    </ol>

                    <button type="button" class="btn-secondary findings-explore-btn" data-action="explore-graph">${escapeHtml(dict.exploreFullGraph)}</button>
                </section>
            </div>`;
}

function renderFindingsView(findings: CycleFindings): string {
    const blocksHtml = SUPPORTED_LANGUAGES.map((lang) => renderFindingsOverview(findings, lang)).join('\n');

    return `
        <main id="findings-view">
            ${blocksHtml}
        </main>`;
}

// Small, plain, always-visible switcher (Findings/Graph tabs + language
// select) - a persistent header, not per-view chrome, so it survives
// switching either way. Tab/language LABELS are the only Graph-adjacent
// text this task localizes (data-i18n, swapped by applyLanguage() below)
// - everything else in the Graph view keeps its existing English text
// unchanged, per this task's explicit scope (see i18n.ts).
function renderAppHeader(): string {
    const dict = I18N[SUPPORTED_LANGUAGES[0]];

    return `
        <header id="app-header">
            <span id="app-header-title">${escapeHtml(dict.appTitle)}</span>

            <nav id="view-tabs" aria-label="Report view">
                <button type="button" class="view-tab is-active" data-view="findings" aria-selected="true" data-i18n="tabFindings">${escapeHtml(dict.tabFindings)}</button>
                <button type="button" class="view-tab" data-view="graph" aria-selected="false" data-i18n="tabGraph">${escapeHtml(dict.tabGraph)}</button>
            </nav>

            <!-- Graph UX pass (navbar restructure). Moved here from the
                 Graph toolbar - this opens general reference material about
                 what a cycle/SCC IS (see #cycle-info-modal below), it does
                 not control the graph itself, so it doesn't belong among
                 Layout/Area/Connections/Fit Graph. Lives in the navbar
                 (persistent across both Findings and Graph views, matching
                 where the language switcher already lives) as a secondary/
                 help action - see .header-help-btn in styles.ts for the
                 deliberately quieter styling that keeps it from competing
                 with the Findings/Graph tabs. Same #cycle-info-btn id, same
                 click handler, same modal - only its position in the DOM
                 changed, not its behavior. -->
            <button type="button" id="cycle-info-btn" class="header-help-btn" data-i18n="cycleInfoButton">${escapeHtml(dict.cycleInfoButton)}</button>

            <label id="language-switcher">
                <span data-i18n="languageLabel">${escapeHtml(dict.languageLabel)}</span>:
                <select id="language-select" aria-label="Language">
                    ${SUPPORTED_LANGUAGES.map((code) => `<option value="${code}">${code.toUpperCase()}</option>`).join('')}
                </select>
            </label>
        </header>`;
}

// F1: a plain, English-only notice - deliberately not run through the
// 14-language i18n dictionary system the rest of this report uses. It
// states a fact about analysis completeness, not a translated UI label,
// and this task's scope is surfacing that fact, not extending i18n
// coverage. data-incomplete-analysis is the stable, prose-independent hook
// a consumer (or a test) can check for instead of matching wording.
function renderUnresolvedImportsNotice(unresolvedImports: UnresolvedImport[]): string {
    if (unresolvedImports.length === 0) {
        return '';
    }

    const items = unresolvedImports
        .map((entry) => {
            // F30: path.basename(entry.file) alone collides for two files
            // sharing a filename in different directories (src/foo/index.ts
            // and src/bar/index.ts both rendering as "index.ts", making it
            // impossible to tell which one this warning is about) - the
            // exact defect F17 already fixed for the CLI/report metrics
            // display. process.cwd()-relative is that same fix's own
            // convention (see metrics/report.ts's displayName() and
            // analyzeCycles.ts's own CLI unresolved-imports warning, both
            // already using path.relative(process.cwd(), file)) - reused
            // here rather than inventing a second path-formatting scheme.
            const file = escapeHtml(path.relative(process.cwd(), entry.file));
            const specifier = escapeHtml(entry.specifier);

            return `<li><code>${file}</code> &rarr; <code>${specifier}</code></li>`;
        })
        .join('');

    return `
        <div id="unresolved-imports-warning" data-incomplete-analysis="true" role="alert">
            <p>Analysis incomplete: ${unresolvedImports.length} import(s) could not be resolved.</p>
            <ul id="unresolved-imports-list">${items}</ul>
        </div>`;
}

export function buildHtmlTemplate(args: BuildHtmlTemplate) {
    const { nodes, edges, findings, unresolvedImports = [] } = args;
    const defaultDict = I18N[SUPPORTED_LANGUAGES[0]];
    const sccSummaryText = renderSccSummaryText(findings, defaultDict);
    const graphScaleText = renderScaleText(defaultDict, findings.moduleCount, findings.dependencyCount);
    const appHeaderHtml = renderAppHeader();
    const unresolvedImportsHtml = renderUnresolvedImportsNotice(unresolvedImports);
    const findingsViewHtml = renderFindingsView(findings);

    // Raw counts behind #scc-summary/#graph-scale-text, embedded so
    // renderGraphScaleTexts() (script below) can recompute both strings
    // for any language on demand - #graph-explorer is not duplicated
    // per-language the way .findings-lang-block is (14 of those would be
    // wasteful for a live cytoscape instance), so this content is
    // client-re-rendered on language change instead of server-pre-rendered.
    const graphSccSummaryCounts = {
        sccCount: findings.sccs.length,
        largestSccSize: findings.sccs.length === 0 ? 0 : Math.max(...findings.sccs.map((scc) => scc.size)),
    };
    const graphScaleCounts = {
        moduleCount: findings.moduleCount,
        dependencyCount: findings.dependencyCount,
    };

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
        ${appHeaderHtml}

        ${unresolvedImportsHtml}

        ${findingsViewHtml}

        <!-- Findings/Graph views (information architecture rework).
             #graph-explorer/#bottom-hud together ARE the "Graph" view -
             everything from here down to the matching closing </div>
             below is exactly what used to be #cy/#hint/#toolbar as direct
             children of <body>, unchanged among themselves, just wrapped
             in one container so their own
             "position: absolute, no positioned ancestor" rules (see
             styles.ts) resolve relative to THIS wrapper's own top-left
             corner. Both this wrapper and #bottom-hud are always present
             in the DOM from page load and hidden via visibility (see
             styles.ts), never display:none: cytoscape's own container-size
             reads (applyInitialView/fitCyAvoidingChrome, both unchanged)
             run synchronously as part of the very first layout below, long
             before the user could ever click the "Graph" tab - a
             display:none container would report zero width/height at that
             exact moment and permanently corrupt the initial zoom/pan
             math. visibility:hidden keeps real, correct dimensions
             available the whole time, so switchToView() (see the script
             below) only ever needs to flip a CSS state, never re-run or
             repair any existing graph/layout/fit logic. -->
        <div id="graph-explorer">
        <div id="cy"></div>
        <div id="hint">
            <!-- Findings data foundation (Phase 0). Global entry point
                 into cycle investigation - answers "are there any SCCs,
                 how many, how big" before the user has to find and click
                 one themselves. Server-rendered directly from the real
                 CycleFindings payload (buildCycleFindings.ts, Kosaraju/
                 findSCCs-derived - never detectCycles(), which can
                 undercount when cycles share a node) computed once in
                 analyzeCycles.ts and threaded through generateHtml ->
                 buildHtmlTemplate - this used to be computed client-side
                 from cy.nodes()' sccId/sccSize attributes
                 (renderSccSummary(cy), now removed) after the graph
                 loaded; the same numbers are now already correct the
                 moment the page renders, with no client-side recomputation
                 and no dependency on the graph library having loaded at
                 all. The caption is deliberate, not decorative: this count
                 always describes the full analyzed graph, never whatever
                 the Area/Connections filters currently show - both counts
                 come from the whole scanned graph, not from
                 visibleNodes/visibleEdges. -->
            <div id="scc-summary">
                <strong data-i18n="detectedSccsHeading">Detected SCCs</strong><br />
                <span style="font-size: 11px; color: #6b7280;" data-i18n="detectedSccsCaption">(entire analyzed graph, not the current filtered view)</span><br />
                <span id="graph-scale-text" style="font-size: 11px; color: #6b7280;">${graphScaleText}</span><br />
                <span id="scc-summary-text">${sccSummaryText}</span>
            </div>

            <strong data-i18n="moduleAreaHeading">Module area</strong><br />
            <span style="font-size: 11px; color: #6b7280;" data-i18n="moduleAreaCaption">(from project structure)</span>
            <div id="area-legend" style="display: flex; flex-direction: column; gap: 3px; margin-top: 6px;"></div>
            <br />

            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="highlight-toggle" checked />
                <span data-i18n="highlightConnectedToggle">Highlight connected modules</span>
            </label>
        </div>

        <div id="toolbar">
            <label>
                <span data-i18n="layoutLabel">Layout:</span>
                <select id="layout-select">
                    <option value="dagreLR" data-i18n="layoutDagreLR">Dagre LR</option>
                    <option value="dagreTB" data-i18n="layoutDagreTB">Dagre TB</option>
                    <option value="dagreLRClean" data-i18n="layoutDagreLRClean">Dagre LR (straight edges, no overlap)</option>
                    <option value="flowTB" data-i18n="layoutFlowTB">Flow / Hierarchical (Top to Bottom)</option>
                    <option value="flowOrthogonal" data-i18n="layoutFlowOrthogonal">Hierarchical (Orthogonal, Top to Bottom)</option>
                    <option value="flowOrthogonalLR" data-i18n="layoutFlowOrthogonalLR">Hierarchical (Orthogonal, Left to Right)</option>
                    <option value="flowVertical" selected data-i18n="layoutFlowVertical">Hierarchical (Orthogonal, Vertical Flow)</option>
                    <option value="breadthfirst" data-i18n="layoutBreadthfirst">Breadth First</option>
                    <option value="cose" data-i18n="layoutCose">Force Directed</option>
                </select>
            </label>

            <label>
                <span data-i18n="areaLabel">Area:</span>
                <select id="area-select">
                    <option value="" data-i18n="areaAllOption">All</option>
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
                <span data-i18n="connectionsLabel">Connections:</span>
                <select id="connection-select" disabled>
                    <option value="internal" selected data-i18n="connectionsInternal">Internal only</option>
                    <option value="external" data-i18n="connectionsExternal">With external connections</option>
                </select>
            </label>

            <button id="fit-btn" data-i18n="fitGraphButton">
                Fit Graph
            </button>

            <!-- Local/Focused-graph UX pass. Hidden until focusScc() below
                 activates it - the explicit, always-in-the-same-place way
                 back to the full graph, independent of whatever the Bottom
                 HUD currently shows (its content fully regenerates on every
                 selection change, so an exit control living only inside it
                 would be an unreliable moving target). Text is NOT swept by
                 the generic data-i18n pass (deliberately has no data-i18n
                 attribute) - focusScc()/updateFocusToolbarLabels() below set
                 its textContent directly, since it also carries a live
                 "(X of Y modules)" count that a static translated string
                 alone can't express; see updateFocusToolbarLabels() for the
                 language-switch-while-focused re-render. -->
            <button id="show-full-graph-btn" hidden>
                Show full graph
            </button>

            <!-- Local/Focused-graph UX pass. A short, quiet disclosure of
                 whatever the core "(X of Y modules)" count on the exit
                 button above doesn't already say: a representative cycle
                 shown instead of a huge SCC's full membership
                 (FOCUS_FULL_SCC_MAX/focusScc below), and/or a truncated
                 neighbour set (P0-1 fix, FOCUS_NEIGHBOR_LIMIT/focusScc) -
                 so neither case is ever mistaken for "this is the whole
                 focused view". Never shown for an ordinary small/medium
                 SCC with few neighbours, which focus already displays in
                 full - there is nothing to disclose in that case. -->
            <span id="focus-status" class="focus-status-note" hidden></span>

            <div id="zoom-controls">
                <button id="zoom-out-btn" aria-label="Zoom out" data-i18n-aria="zoomOutLabel">&minus;</button>
                <span id="zoom-level">100%</span>
                <button id="zoom-in-btn" aria-label="Zoom in" data-i18n-aria="zoomInLabel">+</button>
            </div>
        </div>
        </div>

        <!-- Experimental (branch: experiment/cycle-map-v2). #minimap-container
             itself is only ever moved here via CSS/DOM nesting; its canvas
             id and all the drawing/drag JS below are untouched. -->
        <div id="bottom-hud">
            <!-- Presentation-only cleanup (Graph UX pass): the Ca/Ce/
                 Instability explanation that used to live here was removed
                 from THIS view because it's a separate concept
                 (stability/instability) from what this screen is about
                 (exploring dependency cycles/SCCs) - not because the
                 underlying data or i18n strings went away. The dictionary
                 keys (hudHelpCaExplanation, hudHelpCeExplanation,
                 instabilityLabel, hudHelpInstabilityScale) and the raw
                 data.ca/data.ce/data.instability values on every node are
                 all still fully intact (see i18n.ts and
                 buildCytoscapeElements.ts) for a future, dedicated
                 stability feature to surface. -->
            <div id="hud-help">
                <strong>dep-health-analyzer</strong><br /><br />

                <span data-i18n="hudHelpHoverLine">Hover over a module to see dependency metrics.</span><br />
                <span data-i18n-html="hudHelpClickLine">Click a module <strong>to pin</strong> the tooltip.</span>
            </div>

            <div id="hud-selected">
                <span id="hud-selected-body" class="hud-selected-empty">Click a module to see details.</span>
            </div>

            <div id="minimap-container">
                <canvas id="minimap-canvas" width="220" height="160"></canvas>
            </div>
        </div>

        <!-- Experimental (branch: experiment/cycle-map-v2, cycle node
             details + educational modal; terminology corrected under the
             SCC-vs-cycle fix - an SCC is a group of mutually reachable
             modules, guaranteed to contain at least one cycle but not
             itself a single cycle). A native <dialog> - ESC-to-close and a
             focus-trapped modal backdrop come from the platform for free,
             no library/framework needed to keep this a standalone HTML
             file. This is general reference material about what a
             cycle/SCC IS and how they relate, not something about any
             particular selected node - see the per-node SCC context added
             to updateSelectedModulePanel() below for that. Every claim
             here follows dep-health-analyzer's own architectural-awareness
             (not architectural-enforcement) framing: a detected cycle or
             SCC is an observed graph fact to investigate, never a
             verdict. -->
        <dialog id="cycle-info-modal">
            <h2 data-i18n="eduModalTitle">Dependency cycles</h2>

            <h3 data-i18n="eduModalWhatIsCycleHeading">What is a dependency cycle?</h3>
            <p data-i18n="eduModalWhatIsCycleBody">
                A dependency cycle happens when a chain of dependency
                relationships eventually leads back to a module already
                reached earlier in the same chain - for example:
            </p>
            <p class="cycle-info-example" dir="ltr">A &rarr; B &rarr; C &rarr; A</p>
            <p data-i18n="eduModalExampleCaption">
                Here, A depends on B, B depends on C, and C depends back on
                A - closing the chain into a cycle.
            </p>

            <h3 data-i18n="eduModalWhatIsSccHeading">What is an SCC?</h3>
            <p data-i18n="eduModalWhatIsSccBody1">
                dep-health-analyzer detects cycles by finding Strongly
                Connected Components (SCCs): an SCC is a group of modules
                where every module can reach every other module in the
                group by following dependency relationships.
            </p>
            <p data-i18n="eduModalWhatIsSccBody2">
                A non-trivial SCC (2 or more modules) always contains at
                least one dependency cycle - but an SCC is not itself a
                single cycle. It can contain several distinct cycles that
                share some of the same modules. This report highlights
                each detected SCC as a whole, not one specific cycle path
                within it.
            </p>

            <h3 data-i18n="eduModalWhyMatterHeading">Why can cycles matter?</h3>
            <p data-i18n="eduModalWhyMatterIntro">A dependency cycle may:</p>
            <ul>
                <li data-i18n="eduModalWhyMatterItem1">make the dependency relationships between those modules harder to reason about</li>
                <li data-i18n="eduModalWhyMatterItem2">increase coupling between the modules involved</li>
                <li data-i18n="eduModalWhyMatterItem3">make it harder to isolate or reuse a single module from the group on its own</li>
                <li data-i18n="eduModalWhyMatterItem4">make changes touch more of the SCC than a change to a single, non-cyclic module would</li>
            </ul>

            <h3 data-i18n="eduModalWhatReportsHeading">What does dep-health-analyzer report?</h3>
            <p data-i18n="eduModalWhatReportsBody">
                dep-health-analyzer reports the dependency structures it
                detects in the scanned graph - it does not know this
                project's intended architecture.
            </p>
            <p class="cycle-info-emphasis" data-i18n="eduModalEmphasis">
                A detected cycle or SCC is not automatically an architectural violation.
            </p>
            <p data-i18n="eduModalIntentionalBody">
                Some cyclic relationships are intentional. Only someone who
                knows this project's intended architecture can decide
                whether a specific detected cycle is one worth changing.
            </p>

            <h3 data-i18n="eduModalHowToInvestigateHeading">How to investigate a detected SCC</h3>
            <ol>
                <li data-i18n="eduModalStep1">Select a module that is part of a detected SCC.</li>
                <li data-i18n="eduModalStep2">Inspect the other modules in that SCC.</li>
                <li data-i18n="eduModalStep3">Follow the dependency directions between them.</li>
                <li data-i18n="eduModalStep4">Understand why the relationships exist.</li>
                <li data-i18n="eduModalStep5">Decide whether the structure is appropriate for the project's intended architecture.</li>
            </ol>

            <button id="cycle-info-close-btn" type="button" data-i18n="closeButton">Close</button>
        </dialog>

        <!-- Experimental (branch: experiment/cycle-map-v2, concrete
             dependency cycle). Distinct from cycle-info-modal above (general
             reference material) and from the per-node SCC context in the
             Bottom HUD (which describes an SCC's whole membership) - this
             shows ONE concrete, ordered directed cycle through a specific
             selected module. An SCC is a group of mutually reachable
             modules that can contain several distinct cycles; this modal
             is deliberately never "the cycle for this SCC", only "a cycle
             through the module you picked" - see openCycleDetailModal()
             below for how it's found and why the wording stays plural/
             non-exhaustive. Reuses the same native <dialog> pattern as
             cycle-info-modal (no new modal infrastructure). -->
        <dialog id="cycle-detail-modal">
            <div class="cycle-detail-header">
                <h2 data-i18n="cycleModalTitle">Dependency cycle</h2>
                <span id="cycle-detail-count-badge" class="cycle-count-badge"></span>
            </div>
            <div id="cycle-detail-body"></div>
            <button id="cycle-detail-close-btn" type="button" data-i18n="closeButton">Close</button>
        </dialog>

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

            // Experimental (branch: experiment/cycle-map-v2, SCC member
            // navigation). escapeHtml() above is only safe for TEXT
            // content - browsers don't escape '"' when serializing
            // textContent back to innerHTML, only '&'/'<'/'>'. A node id
            // is a real file path (this codebase's own existing tests
            // already craft file paths containing a closing script tag to
            // prove XSS resistance elsewhere - deliberately not spelled
            // out literally in this comment, since this file IS that
            // script: writing the real characters here would prematurely
            // close it, exactly like the vulnerability being described),
            // so embedding a path inside a double-quoted HTML attribute
            // (data-scc-nav-id="...") needs this extra step, or a path
            // containing a literal '"' could break out of the attribute.
            function escapeAttribute(value) {
                return escapeHtml(value).replace(/"/g, '&quot;');
            }

            // Presentation-only path formatting (Graph UX pass). Every
            // node's real, full path (data.id) is shown as its own gray
            // secondary line (.hud-selected-path, in the HUD panel and in
            // the cycle-detail modal's member list) - but that line is
            // often long, and the directory portion is what actually tells
            // you WHERE the file lives, while the filename itself is
            // already shown separately, bold, right above it. Wrapping
            // just the directory portion in its own subtle background
            // (.path-dir, styles.ts) lets the eye jump straight to "which
            // folder" instead of reading the whole string character by
            // character. Splits on the LAST '/' only - every id here is a
            // real filesystem path from the scanner (posix-style
            // separators), never something needing a general path-parsing
            // library. Each half is escaped separately (not the whole
            // string once) since they're wrapped in different HTML.
            //
            // RTL note: every call site wraps this function's output in
            // its own dir="ltr" span. A leading '/' (or any path
            // separator) is Unicode bidi-neutral, and inside an RTL
            // paragraph (Arabic - the whole HUD/modal chrome mirrors, see
            // applyLanguage() above) the bidi algorithm was measured to
            // visually move that leading slash to the far end of the
            // string instead of leaving it at the front - a pre-existing
            // glitch in this same line before this function existed
            // (reproduced against the un-split path too), fixed here
            // because this is the exact rendering this change touches.
            // File paths are technical data, not translatable prose - like
            // the module-name/path list in buildCycleContextHtml or the
            // "A -> B -> C -> A" example in the educational modal, they
            // should never be subject to the paragraph's own bidi
            // reordering.
            function renderPathWithDirHighlight(rawPath) {
                const lastSlash = rawPath.lastIndexOf('/');

                if (lastSlash === -1) {
                    return escapeHtml(rawPath);
                }

                const dir = rawPath.slice(0, lastSlash + 1);
                const filename = rawPath.slice(lastSlash + 1);

                return '<span class="path-dir">' + escapeHtml(dir) + '</span>' + escapeHtml(filename);
            }

            // --- Findings/Graph views + language switcher --------------
            //
            // Deliberately placed first, before any of the graph/
            // cytoscape setup below - none of this depends on cy existing
            // (it only ever touches plain, already-rendered DOM and a
            // small embedded dictionary), and running it first means a
            // returning reader with a saved non-English preference sees
            // the right language immediately, with no flash of English
            // while the (heavier) graph initializes underneath.
            //
            // "Switching views" is a pure CSS-state flip (see
            // #findings-view.is-hidden / #graph-explorer.is-active /
            // #bottom-hud.is-active in styles.ts), never a re-render or
            // a graph teardown/rebuild - Focus SCC, selection, filters,
            // zoom/pan, and the minimap all survive switching away and
            // back for free, simply because nothing here ever touches
            // them.
            function switchToView(view) {
                const isGraph = view === 'graph';

                document.getElementById('findings-view')?.classList.toggle('is-hidden', isGraph);
                document.getElementById('graph-explorer')?.classList.toggle('is-active', isGraph);
                document.getElementById('bottom-hud')?.classList.toggle('is-active', isGraph);

                document.querySelectorAll('.view-tab').forEach((tab) => {
                    const isActiveTab = tab.dataset.view === view;
                    tab.classList.toggle('is-active', isActiveTab);
                    tab.setAttribute('aria-selected', String(isActiveTab));
                });
            }

            document.querySelectorAll('.view-tab').forEach((tab) => {
                tab.addEventListener('click', () => switchToView(tab.dataset.view));
            });

            // Findings-first navigation: a finding row (server-rendered,
            // see renderSccFindingRow in the Node-side template code)
            // carries its own sccId as a data attribute
            // (data-finding-scc-id) - this is the one listener that makes
            // both the row itself and its "View cycle" button interactive
            // (a click on the button bubbles up to the same
            // [data-finding-scc-id] ancestor, so one delegated check
            // covers both). openCycleDetailModalForScc (defined further
            // below, after the graph exists - safe to reference here
            // ahead of its own definition, since nothing calls it until a
            // real click happens, long after the whole script has run
            // once) never searches by module name, only by this id.
            // data-action="explore-graph" (the zero-state and
            // end-of-list buttons) is handled in the same listener, since
            // both live inside the same #findings-view container.
            document.getElementById('findings-view')?.addEventListener('click', (event) => {
                const exploreEl = event.target.closest('[data-action="explore-graph"]');

                if (exploreEl) {
                    switchToView('graph');
                    return;
                }

                const row = event.target.closest('[data-finding-scc-id]');

                if (!row) {
                    return;
                }

                openCycleDetailModalForScc(Number(row.dataset.findingSccId));
            });

            // Plain %token substitution, mirroring i18n.ts's own
            // formatI18n() (server-side) - kept as a small separate copy
            // rather than an import, the same split already established
            // for escapeHtml (browser code can't import the Node-side
            // module). Only used for the header's own tiny static labels
            // (data-i18n) - the Findings view's own (much larger,
            // per-finding-dynamic) content is never re-templated
            // client-side at all; every language's version is already
            // fully pre-rendered server-side (see renderFindingsOverview
            // in template.ts) and this only ever toggles which one is
            // visible.
            const I18N_DICTIONARIES = ${safeJsonForScript(I18N)};
            const LANGUAGE_STORAGE_KEY = 'dep-health-language';
            const SUPPORTED_LANGUAGE_CODES = ${safeJsonForScript(SUPPORTED_LANGUAGES)};
            const RTL_LANGUAGE_CODES = ${safeJsonForScript([...RTL_LANGUAGES])};

            // Full localization task. Raw counts behind the Graph view's
            // own #graph-scale-text/#scc-summary-text (see renderSccSummaryText/
            // the graphScaleCounts computation in template.ts) - unlike
            // .findings-lang-block, #graph-explorer is never duplicated
            // per language, so this text is recomputed here on every
            // language change instead of being one of 14 pre-rendered
            // server-side blocks.
            const GRAPH_SCALE_COUNTS = ${safeJsonForScript(graphScaleCounts)};
            const GRAPH_SCC_SUMMARY_COUNTS = ${safeJsonForScript(graphSccSummaryCounts)};

            // The currently active language and (once the graph exists)
            // whichever dynamic Graph content is on screen right now, so a
            // language switch mid-session can re-render it instead of
            // leaving it stuck in the previous language. graphReady stays
            // false until the very end of this script - applyLanguage()'s
            // very first call (below) runs before cy/selectedNodeId/the
            // modals exist, and at that point there is nothing selected or
            // open yet to re-render anyway.
            let currentLanguage = SUPPORTED_LANGUAGE_CODES[0];
            let graphReady = false;

            // Plain %token substitution, mirroring i18n.ts's own
            // formatI18n() (server-side) - kept as a small separate copy
            // rather than an import, the same split already established
            // for escapeHtml (browser code can't import the Node-side
            // module). Used by every client-side dynamic-content function
            // below (updateSelectedModulePanel, buildCycleContextHtml,
            // openCycleDetailModal, ...) that has to build translated text
            // at generation time, since - unlike Findings - that content is
            // regenerated on every selection/click, not pre-rendered once
            // per language server-side.
            function formatI18nClient(template, vars) {
                return template.replace(/%(\\w+)/g, (match, key) => (key in vars ? String(vars[key]) : match));
            }

            function renderGraphScaleTexts(dict) {
                const scaleEl = document.getElementById('graph-scale-text');
                if (scaleEl) {
                    const modulesText = formatI18nClient(
                        GRAPH_SCALE_COUNTS.moduleCount === 1 ? dict.scaleModulesSingular : dict.scaleModules,
                        { n: GRAPH_SCALE_COUNTS.moduleCount }
                    );
                    const dependenciesText = formatI18nClient(
                        GRAPH_SCALE_COUNTS.dependencyCount === 1
                            ? dict.scaleDependenciesSingular
                            : dict.scaleDependencies,
                        { n: GRAPH_SCALE_COUNTS.dependencyCount }
                    );
                    scaleEl.textContent = modulesText + ' \\u00b7 ' + dependenciesText;
                }

                const summaryEl = document.getElementById('scc-summary-text');
                if (summaryEl) {
                    // innerHTML, not textContent - detectedSccsSummary
                    // embeds a real &middot; entity (matching sccLabel's
                    // own convention elsewhere in this dictionary), which
                    // textContent would print as the literal 6 characters
                    // "&middot;" instead of rendering the dot. Trusted,
                    // translator-authored dictionary text, never user
                    // input - same trust boundary as the data-i18n-html
                    // swap loop in applyLanguage() above.
                    summaryEl.innerHTML =
                        GRAPH_SCC_SUMMARY_COUNTS.sccCount === 0
                            ? dict.noDependencySccsDetected
                            : formatI18nClient(dict.detectedSccsSummary, {
                                  n: GRAPH_SCC_SUMMARY_COUNTS.sccCount,
                                  largest: GRAPH_SCC_SUMMARY_COUNTS.largestSccSize,
                              });
                }
            }

            function applyLanguage(lang) {
                currentLanguage = lang;

                document.querySelectorAll('.findings-lang-block').forEach((block) => {
                    block.hidden = block.dataset.lang !== lang;
                });

                const dict = I18N_DICTIONARIES[lang];

                document.querySelectorAll('[data-i18n]').forEach((el) => {
                    const text = dict[el.dataset.i18n];
                    if (typeof text === 'string') {
                        el.textContent = text;
                    }
                });

                // Rich-HTML dictionary entries (embedded <br /> / entities,
                // e.g. the Ca/Ce HUD-help explanations) - trusted,
                // translator-authored content baked into I18N_DICTIONARIES
                // at build time, never user input, so innerHTML here carries
                // the same trust boundary as the escapeHtml(dict.x) calls
                // used for these same dictionaries server-side.
                document.querySelectorAll('[data-i18n-html]').forEach((el) => {
                    const html = dict[el.dataset.i18nHtml];
                    if (typeof html === 'string') {
                        el.innerHTML = html;
                    }
                });

                document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
                    const text = dict[el.dataset.i18nAria];
                    if (typeof text === 'string') {
                        el.setAttribute('aria-label', text);
                    }
                });

                const isRtl = RTL_LANGUAGE_CODES.includes(lang);

                // #app-header is the one localized surface that isn't
                // pre-rendered per language (see the header's own
                // data-i18n text-swap above) - unlike each
                // .findings-lang-block, which already has the right
                // dir="rtl" baked in server-side for Arabic (see
                // renderFindingsOverview in template.ts), the header
                // needs its direction flipped here instead.
                const appHeader = document.getElementById('app-header');
                if (appHeader) {
                    if (isRtl) {
                        appHeader.setAttribute('dir', 'rtl');
                    } else {
                        appHeader.removeAttribute('dir');
                    }
                }

                // Full localization task. These are the Graph view's own
                // chrome/text panels, now localized the same way - plain
                // information/control surfaces around the graph, never the
                // graph itself. #graph-explorer (and #cy within it) and
                // #minimap-canvas's own drawing are deliberately never
                // included in this list, so the dependency graph's own
                // node layout and edge/arrow direction (A -> B meaning)
                // never mirrors regardless of interface language - the
                // concrete-cycle modal's own flow diagram gets the same
                // protection for the same reason (see the unconditional
                // dir="ltr" on .cycle-flow in buildCycleFlowHtml below): it
                // renders one real, ordered dependency path, not prose.
                ['hint', 'toolbar', 'bottom-hud', 'cycle-info-modal', 'cycle-detail-modal'].forEach(
                    (id) => {
                        const el = document.getElementById(id);
                        if (!el) {
                            return;
                        }
                        if (isRtl) {
                            el.setAttribute('dir', 'rtl');
                        } else {
                            el.removeAttribute('dir');
                        }
                    }
                );

                renderGraphScaleTexts(dict);

                const languageSelect = document.getElementById('language-select');
                if (languageSelect) {
                    languageSelect.value = lang;
                }

                // Re-render whichever dynamic Graph content is currently on
                // screen so a language switch mid-session doesn't leave it
                // stuck in the previous language. Guarded on graphReady -
                // see its own declaration above.
                if (graphReady) {
                    if (selectedNodeId) {
                        const node = cy.getElementById(selectedNodeId);
                        if (!node.empty()) {
                            if (node.data('isExternalProxy')) {
                                updateSelectedAreaProxyPanel(node);
                            } else {
                                updateSelectedModulePanel(node);
                            }
                        }
                    } else if (hudSelectedBody) {
                        hudSelectedBody.className = 'hud-selected-empty';
                        hudSelectedBody.textContent = dict.hudSelectedEmptyText;
                    }

                    if (cycleDetailModal && cycleDetailModal.open && currentCycleDetailNodeId) {
                        openCycleDetailModal(currentCycleDetailNodeId);
                    }

                    if (currentFocus) {
                        updateFocusToolbarLabels();

                        // P0-1 fix: the overflow summary proxy's own
                        // on-canvas label (unlike a real area proxy's,
                        // which is just the raw untranslated area name) is
                        // translated text - re-render it here the same way
                        // every other dynamic Graph label already is.
                        const overflowProxy = cy.getElementById(FOCUS_OVERFLOW_PROXY_ID);
                        if (!overflowProxy.empty()) {
                            overflowProxy.data(
                                'label',
                                formatI18nClient(dict.focusOverflowProxyLabel, {
                                    n: overflowProxy.data('focusOverflowCount'),
                                }),
                            );
                        }
                    }
                }

                // Wrapped defensively - private browsing / a disabled
                // storage API must never break language switching itself,
                // only its persistence across page loads.
                try {
                    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
                } catch {
                    // Ignored - the language still applies for this view.
                }
            }

            function getInitialLanguage() {
                try {
                    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
                    if (saved && SUPPORTED_LANGUAGE_CODES.includes(saved)) {
                        return saved;
                    }
                } catch {
                    // Ignored - falls through to the English default.
                }
                return SUPPORTED_LANGUAGE_CODES[0];
            }

            document.getElementById('language-select')?.addEventListener('change', (event) => {
                applyLanguage(event.target.value);
            });

            applyLanguage(getInitialLanguage());

            // -------------------------------------------------------------

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
                // character from two other levers instead: a wider rankSep
                // (400 vs flowOrthogonal's 200) so ranks read as clearly
                // separated bands with real vertical distance between them,
                // and wrapWideRanks() called in recenter-only mode (see the
                // Infinity maxRankWidth in onLayoutFinished below) purely to
                // remove the sideways spread dagre adds to keep unrelated
                // columns aligned - not to force anything narrower than its
                // own content needs.
                //
                // rankSep tuning pass (layout readability investigation):
                // this was 700 - chosen, per the original comment here, to
                // give the orthogonal taxi jog "more room to clear other
                // nodes" than flowOrthogonal's 200px gap. Re-measured
                // directly in headless Chrome (real node/edge positions,
                // real taxi-path segments via computeEdgePathSegments(),
                // not guessed) across five graphs - a 5-module 2-node-cycle
                // fixture, large-cycle-app (19 modules, one 7-module SCC
                // ring), nightmare-app (41 modules/57 deps), and
                // dep-health-analyzer's own ~115-module source tree (the
                // most branch-heavy real graph on hand, and the one 700 was
                // originally tuned against) - found that overlap-clearance
                // stops improving well before 700: node overlaps, edge-node
                // overlaps, and taxi-edge crossings were IDENTICAL at
                // rankSep 400 and rankSep 700 on every one of those graphs
                // (e.g. dep-health-analyzer's own graph: 1 node overlap + 16
                // edge-node overlaps at BOTH 400 and 700; the other four
                // fixtures stayed at their already-clean 0 overlaps
                // regardless of rankSep from 200 all the way to 700). What
                // 700 bought beyond that point was pure inflation - at 700,
                // every edge (not just the ones that needed the room) is
                // ~1.75x longer than at 400, and the whole layout is
                // ~1.7x taller, for identical readability. 400 is a
                // deliberate margin above where quality actually starts
                // degrading (300 already measurably worse than 700 on the
                // dep-health-analyzer graph specifically: 20 edge-node
                // overlaps/1407 crossings vs 16/1402) - this is "as tight as
                // it can go with room to spare", not "as tight as it can
                // go". A separate, pre-existing, NOT rankSep-related
                // node/node overlap on nightmare-app (present at every
                // rankSep tested, 200 through 700) comes from
                // resolveEdgeNodeOverlaps() pushing a node clear of an edge
                // without checking whether that push lands it on top of a
                // different node - a real gap in that function, but a
                // separate, riskier fix than a spacing-constant change;
                // left alone here.
                flowVertical: {
                    name: 'dagre',
                    rankDir: 'TB',
                    nodeSep: 100,
                    rankSep: 400,
                    edgeSep: 40,
                    padding: 60,
                    spacingFactor: 1,
                    fit: false,
                    nodeDimensionsIncludeLabels: true,
                },
            };

            // Layouts whose spacing is wide enough that a follow-up
            // collision-avoidance pass (see resolveEdgeNodeOverlaps below)
            // is worth running - deliberately roomier than dagreLR/dagreTB
            // to keep every straight/taxi edge clear of unrelated nodes.
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
                        // Edge visual hierarchy (Graph UX pass): a base
                        // edge needed to read clearly against a plain white
                        // canvas without competing with the two more
                        // important tiers above it - '.highlighted-edge'
                        // (interactive hover/selection context) and
                        // '.cycle-edge' (a real dependency cycle, the most
                        // important structural fact this report can show -
                        // see '.cycle-edge' below). #6b7280 (vs. the
                        // previous #888) and a touch more width keep this
                        // tier legibly ahead of "barely there" without
                        // making every edge on a large, busy graph read as
                        // bold.
                        selector: 'edge',
                        style: {
                            'curve-style': 'straight',
                            'target-arrow-shape': 'triangle',
                            'line-color': '#6b7280',
                            'target-arrow-color': '#6b7280',
                            'width': 1.8,
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
                    // filter (and Focus - see '.not-in-view' below) is
                    // implemented: a presentation-level toggle on top of
                    // the one full graph, not a second "filtered graph"
                    // data structure.
                    //
                    // P1-5 fix: '.not-in-view' - not '.area-hidden' - is
                    // the actual display driver. '.area-hidden' is now the
                    // narrower "hidden by the Area/Connections filter
                    // specifically, independent of Focus" signal (see
                    // isNodeAreaFiltered()/isEdgeAreaFiltered() above) -
                    // it no longer has any CSS effect of its own, on
                    // purpose, so an element that's outside the frozen Area
                    // filter but INSIDE the current Focus set (Focus always
                    // takes precedence - see isNodeInCurrentView()) stays
                    // visible instead of being hidden by a stale filter
                    // flag. '.not-in-view' is exactly the old combined
                    // '.area-hidden' toggle (isNodeInCurrentView()'s own
                    // negation), renamed so its one remaining job - "is
                    // this actually rendered right now, for whichever
                    // reason" - can't be confused with the narrower
                    // Area-only question again.
                    {
                        selector: '.not-in-view',
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

                    // Edge visual hierarchy, top tier (Graph UX pass): an
                    // edge between two nodes in the SAME real SCC
                    // (sccId/sccSize are only ever set on an actual
                    // non-trivial SCC's own members - see
                    // buildCytoscapeElements.ts) is guaranteed, by the
                    // definition of strong connectivity, to lie on at least
                    // one dependency cycle within that SCC - both endpoints
                    // can already reach each other, so this edge plus
                    // whatever path proves that closes into a loop. Applied
                    // ONCE, right after the graph is constructed (see
                    // markCycleEdges() below), not toggled by
                    // selection/focus - a cycle is a permanent structural
                    // fact about the graph, not a transient interaction
                    // state, so it stays visually dominant even while
                    // something else is hovered/highlighted elsewhere.
                    // Listed AFTER '.highlighted-edge' so its own width/
                    // color always wins whenever both classes could apply,
                    // matching the required hierarchy: normal < highlighted
                    // < cycle. Reuses each SCC's own already-assigned
                    // data(color) (read from the edge's SOURCE node - both
                    // endpoints share the same SCC, hence the same color)
                    // instead of a fixed hue, so a cycle's edges and its
                    // nodes visually read as the same structure - and
                    // deliberately not red/amber (see the qualitative,
                    // non-alarm defaultColors palette in
                    // buildCytoscapeElements.ts): a detected cycle is an
                    // observation to investigate, never a verdict, the same
                    // framing used everywhere else in this report.
                    {
                        selector: '.cycle-edge',
                        style: {
                            'line-color': function (ele) { return ele.source().data('color') || '#374151'; },
                            'target-arrow-color': function (ele) { return ele.source().data('color') || '#374151'; },
                            'width': 3,
                            'arrow-scale': 1.3,
                            'opacity': 1,
                        },
                    },

                    // Focused-graph UX. A direct (1-hop) neighbour of the
                    // cycle/SCC being focused - present for local context
                    // (see focusScc() below), but deliberately secondary to
                    // the cycle itself: a touch of opacity is enough to
                    // make the eye land on the cycle first without hiding
                    // the neighbour's own identity/color the way '.faded'
                    // (0.4, meant for "unrelated to whatever's hovered")
                    // would. Nodes only - a neighbour's own edges to the
                    // cycle already read as plain base-tier edges (they
                    // don't qualify for '.cycle-edge', which is exactly the
                    // point: only the cycle's own internal edges get that
                    // top tier), so no separate edge treatment is needed
                    // here.
                    {
                        selector: '.focus-neighbor',
                        style: {
                            'opacity': 0.75,
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

            // Edge visual hierarchy (Graph UX pass). Computed ONCE, right
            // after construction - SCC membership never changes for the
            // life of this report (it's a fixed analysis result, not
            // something filters/focus/layout ever touch), so this never
            // needs to be recomputed later, unlike '.area-hidden' or the
            // taxi-routing classes. See the '.cycle-edge' style rule above
            // for why "both endpoints share a real sccId" correctly means
            // "this edge lies on a cycle".
            function markCycleEdges(cy) {
                cy.edges().forEach((edge) => {
                    const sourceSccId = edge.source().data('sccId');
                    const targetSccId = edge.target().data('sccId');

                    if (sourceSccId !== undefined && sourceSccId === targetSccId) {
                        edge.addClass('cycle-edge');
                    }
                });
            }

            markCycleEdges(cy);

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

            // Focused-graph UX pass. null = the ordinary Full Graph view;
            // set by focusScc() below to { nodeIds: Set<string>, ... } -
            // the exact set of nodes (a cycle/SCC's core plus its direct
            // neighbours) Focused Graph shows. Checked FIRST, before the
            // Area/Connections filter and before external-area proxies, in
            // both functions below - Focus is a separate, higher-precedence
            // view, not one more filter combined with whatever Area/
            // Connections happens to be set to (see focusScc()'s own
            // comment for why currentAreaFilter/currentConnectionMode are
            // deliberately left untouched while focused rather than reset:
            // this is exactly what makes them come back correctly, for
            // free, the moment Focus exits).
            let currentFocus = null;

            // A proxy node/edge is only ever present in cy while it's
            // meant to be shown (added fresh by addExternalConnectionProxies,
            // removed by removeExternalConnectionProxies the moment the
            // area/connection selection changes) - so unlike real
            // nodes/edges, its being IN cy at all already means "currently
            // in view", with nothing further to check against
            // currentAreaFilter.
            function isNodeInCurrentView(node) {
                if (currentFocus) {
                    return currentFocus.nodeIds.has(node.id());
                }

                if (node.data('isExternalProxy')) {
                    return true;
                }

                return !currentAreaFilter || node.data('area') === currentAreaFilter;
            }

            function isEdgeInCurrentView(edge) {
                if (currentFocus) {
                    return currentFocus.nodeIds.has(edge.source().id()) && currentFocus.nodeIds.has(edge.target().id());
                }

                if (edge.data('isExternalProxy')) {
                    return true;
                }

                return (
                    !currentAreaFilter ||
                    (edge.source().data('area') === currentAreaFilter &&
                        edge.target().data('area') === currentAreaFilter)
                );
            }

            // P1-5 fix (Focus/Area state no longer conflated). Before this,
            // '.area-hidden' was toggled straight off isNodeInCurrentView()/
            // isEdgeInCurrentView() above - i.e. it meant "not in the
            // CURRENT view", Focus included. That's the right question for
            // display (see the CSS-facing '.not-in-view' class below), but
            // several places need the narrower, Focus-INDEPENDENT question
            // "would the Area/Connections filter alone hide this" instead:
            // focusScc()'s own candidate-membership computation, the
            // concrete-cycle modal's hidden-member disclosure/"Show in
            // graph" gating, and the HUD's own Focus-button visible count.
            // Reusing '.area-hidden' for BOTH questions meant switching
            // Focus from one SCC to a completely different one (Findings ->
            // "View cycle" -> "Show in graph" while already focused
            // elsewhere) saw every member of the NEW target SCC as
            // '.area-hidden' - they were outside the OLD focus, nothing to
            // do with the Area filter - so focusScc()'s own allMembers
            // check came back empty and the switch silently did nothing,
            // and the modal's "Show in graph" button could disappear
            // entirely. These two functions are '.area-hidden's real,
            // narrower definition now: always just the (frozen while
            // focused - the Area dropdown is disabled during Focus, see
            // setFocusToolbarState()) currentAreaFilter value, regardless
            // of whatever currentFocus currently is. A proxy is never
            // "area-hidden" - it's a presentation-only artifact of a
            // different filter, not a real module with a real area.
            function isNodeAreaFiltered(node) {
                if (node.data('isExternalProxy')) {
                    return false;
                }

                return Boolean(currentAreaFilter) && node.data('area') !== currentAreaFilter;
            }

            function isEdgeAreaFiltered(edge) {
                if (edge.data('isExternalProxy')) {
                    return false;
                }

                if (!currentAreaFilter) {
                    return false;
                }

                return (
                    edge.source().data('area') !== currentAreaFilter ||
                    edge.target().data('area') !== currentAreaFilter
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

            // Findings data foundation (Phase 0). The SCC summary (count,
            // largest size, module/dependency counts) is no longer
            // computed here - it's server-rendered directly into the
            // #scc-summary markup above from the real CycleFindings
            // payload (buildCycleFindings.ts), before this script ever
            // runs. Kept out of this script entirely, rather than merely
            // unused, since a client-side aggregation over
            // data.sccId/data.sccSize sitting next to the real source of
            // truth would be exactly the kind of second, driftable
            // computation this change exists to remove.

            renderAreaLegend(cy);
            populateAreaSelect(cy);

            // P0-2 fix (pre-v0.10.2 audit, scalability): computeEdgePathSegments/
            // segmentIntersectsRect are pure geometry helpers - moved into
            // graphOverlapResolution.ts so they, and the overlap resolvers
            // that depend on them, can be unit-tested and benchmarked
            // directly in Node (real behavior, not a string-matching
            // assertion against this generated HTML - see that module's
            // own top comment and scripts/benchmark-graph-overlap.mjs).
            // Embedded verbatim below via .toString() so the exact,
            // tested/benchmarked code is what runs in the browser - no
            // separate client reimplementation to drift out of sync.
            // Shared with redrawMinimapStatic below, so the minimap's edge
            // drawing matches the same geometry collision-avoidance checks
            // resolveEdgeNodeOverlaps (below) uses.
            ${computeEdgePathSegments.toString()}

            ${segmentIntersectsRect.toString()}

            ${closestPointOnSegment.toString()}

            // P0-2 fix. Node-count thresholds (see graphOverlapResolution.ts's
            // own top comment for the full benchmark-backed reasoning) that
            // keep resolveEdgeNodeOverlaps/resolveNodeOverlaps below from
            // running an unbounded amount of work on a genuinely huge Full
            // Graph - never applies to Focused Graph, which P0-1 already
            // bounds independently of project size.
            ${edgeNodeOverlapIterationsFor.toString()}

            ${nodeOverlapIterationsFor.toString()}

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

            // P0-2 fix (pre-v0.10.2 audit, scalability). The actual
            // push-nodes-out-of-an-edge's-way algorithm now lives in
            // resolveEdgeNodeOverlapsPure below (embedded verbatim via
            // .toString() from graphOverlapResolution.ts's exported
            // resolveEdgeNodeOverlaps - assigned to a differently-named
            // const here purely to avoid colliding with this file's own
            // cytoscape-facing resolveEdgeNodeOverlaps(cy, options) wrapper
            // below; a function EXPRESSION's own internal name is never
            // visible outside its body, so this is safe, not a rename of
            // the real function). Real behavior of this exact code is
            // unit-tested (graphOverlapResolution.test.ts) and benchmarked
            // (scripts/benchmark-graph-overlap.mjs) directly in Node - see
            // that module's own top comment for the full audit/benchmark
            // writeup, including why this used to cost O(iterations x E x
            // N) with real measured minutes-long hangs on a large project's
            // Full Graph, and what changed.
            const resolveEdgeNodeOverlapsPure = ${resolveEdgeNodeOverlapsPure.toString()};

            // Thin cytoscape glue: snapshot visible nodes/edges into plain
            // records ONCE (this is the P0-2 fix's core change - the
            // pre-fix version called visibleNodes(cy)/visibleEdges(cy)
            // freshly for every edge inside the algorithm's own iteration
            // loop, an O(N) filter repeated E x iterations times for no
            // reason, since which nodes/edges are visible cannot change
            // during this synchronous call), run the pure algorithm above,
            // then write the converged positions back in a single
            // cy.batch() (also cheaper than one cytoscape .position() call
            // per push, as the pre-fix version made throughout the whole
            // iterative process).
            function resolveEdgeNodeOverlaps(cy, options) {
                // F9 fix: the node style is 'width': 'label', 'height':
                // 'label', 'padding': '10px' - node.width()/node.height()
                // return the label box WITHOUT that padding (or any
                // border), so the pure algorithm below (correct on
                // whatever {width, height} it's given) was resolving
                // overlap against boxes smaller than what actually
                // renders, leaving real, rendered boxes still overlapping
                // even once it reported success. outerWidth()/
                // outerHeight() include padding and border - the real
                // rendered box size.
                const plainNodes = visibleNodes(cy).map((node) => {
                    const pos = node.position();
                    return { id: node.id(), x: pos.x, y: pos.y, width: node.outerWidth(), height: node.outerHeight() };
                });
                const plainEdges = visibleEdges(cy).map((edge) => ({
                    sourceId: edge.source().id(),
                    targetId: edge.target().id(),
                }));

                resolveEdgeNodeOverlapsPure(plainNodes, plainEdges, options);

                cy.batch(() => {
                    plainNodes.forEach((node) => {
                        cy.getElementById(node.id).position({ x: node.x, y: node.y });
                    });
                });
            }

            // Focused-graph UX pass. resolveEdgeNodeOverlaps above only
            // ever separates an edge from a node it cuts through - it does
            // nothing about two NODES overlapping each other, which cose
            // (unlike every dagre-based layout here) can produce: its
            // node-repulsion physics were measured to occasionally leave a
            // pair of this report's label-sized rectangular nodes
            // overlapping, especially on a small/medium focused subgraph
            // where randomize: false starts the simulation from whatever
            // positions the previous (often much denser) layout left them
            // at. Tuning cose's own nodeRepulsion/nodeOverlap constants
            // was tried first and rejected: no single value was measured
            // to reliably clear every fixture (raising it far enough to
            // fix a dense hub graph made an already-clean sparse one worse
            // by introducing a NEW overlap) - an explicit post-pass,
            // reusing resolveEdgeNodeOverlaps's own established "push
            // apart by exactly the needed clearance, iterate until
            // nothing moves" technique for this different collision type,
            // is the reliable fix. Only ever separates along whichever
            // axis needs the SMALLER push to clear - minimal disturbance
            // to cose's own otherwise-good layout, not a repositioning
            // from scratch.
            //
            // P0-2 fix: same extraction/embedding treatment as
            // resolveEdgeNodeOverlaps above - see that function's own
            // comment for why (real Node-testable/benchmarkable behavior,
            // one implementation embedded verbatim, cytoscape API calls
            // moved out of the O(iterations x N^2) inner loop).
            const resolveNodeOverlapsPure = ${resolveNodeOverlapsPure.toString()};

            function resolveNodeOverlaps(cy, options) {
                // F9 fix: see resolveEdgeNodeOverlaps's own comment above -
                // outerWidth()/outerHeight() (padding + border included),
                // not width()/height(), is the real rendered box size.
                const plainNodes = visibleNodes(cy).map((node) => {
                    const pos = node.position();
                    return { id: node.id(), x: pos.x, y: pos.y, width: node.outerWidth(), height: node.outerHeight() };
                });

                resolveNodeOverlapsPure(plainNodes, options);

                cy.batch(() => {
                    plainNodes.forEach((node) => {
                        cy.getElementById(node.id).position({ x: node.x, y: node.y });
                    });
                });
            }

            // Experimental (branch: experiment/cycle-map-v2, navigation layer).
            // Every layout config above now has fit:false - "fit the whole
            // graph into the viewport" is no longer the automatic outcome of
            // running a layout; applyInitialView() below decides what the
            // very first view looks like instead.

            // A real bug found while testing: plain cy.fit() sizes the
            // graph to the FULL container, including the corners
            // permanently covered by opaque UI panels (#hint, #toolbar).
            // On a small graph - exactly the case where this "fits
            // comfortably" path runs - a node can fit entirely underneath
            // one of those panels and become completely invisible, even
            // though cy.extent() and the minimap both correctly show it as
            // "in view". Measuring the panels' actual rendered rects and
            // fitting into what's left avoids that.
            //
            // Viewport/fit bug fix (Graph UX pass): hint (top-left) and
            // toolbar (top-right) are both short horizontal bars anchored
            // to the canvas's TOP edge, never tall sidebars reaching deep
            // into its vertical middle. fitCyAvoidingChrome below works
            // with ONE rectangular "safe zone" for the whole fit, not a
            // separate reservation per corner - so the moment a panel's
            // BOTTOM edge sets topInset, that inset already excludes its
            // entire row (every x position within the fit rectangle's
            // width, not just the x range the panel itself occupies), for
            // free. A panel-specific left/right contribution on top of
            // that used to be redundant at best - and, once a panel is
            // allowed to grow wide, actively wrong: toolbar wrapping
            // across nearly the full top strip (see its own max-width
            // comment elsewhere in this file, added so it never overlaps
            // #hint) used to ALSO count its own width as a "right inset"
            // here, which could consume almost the entire canvas width,
            // drive availableWidth below in fitCyAvoidingChrome negative,
            // and force the crude cy.fit() fallback there - which knows
            // nothing about hint/toolbar and centers on the RAW container
            // instead. That's the exact, confirmed cause of the Full
            // Graph rendering skewed left with a large empty gap on the
            // right: not a CSS/centering issue, a viewport-math one.
            // Confirmed in headless Chrome (large-cycle-app, several
            // window sizes): removing hint's/toolbar's left/right
            // contributions - keeping each one's own top contribution,
            // which already fully protects against overlap regardless of
            // x - fixes the skew without moving a single graph node; this
            // is viewport/fit math only, dagre's own hierarchical layout
            // is completely untouched.
            //
            // #minimap-container is no longer measured here at all: it
            // lives inside #bottom-hud, a separate fixed bar BELOW
            // #graph-explorer/#cy (see styles.ts - #graph-explorer's own
            // height already excludes --bottom-hud-height), so it can
            // never visually overlap anything rendered inside this
            // container. Its previous "right"/"bottom" contributions were
            // already dead code in practice - bottom always came out
            // negative (and so got clamped to 0) because minimap.top
            // already sits past containerRect.bottom - removed as
            // misleading no-op code now that this function is being
            // corrected anyway, rather than left in place.
            //
            // UPDATE (final pre-release audit, P0 fix): the "hint/toolbar
            // are both short horizontal bars, never tall sidebars" premise
            // above no longer holds for #hint - it now carries the Module
            // area legend, which can make it far taller than #toolbar ever
            // gets. See measureChromeInsets' own comment on the hint
            // branch below for why #hint's contribution moved from top to
            // left; #toolbar's own top contribution is unaffected and the
            // reasoning above for it still applies as written.
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

                // right stays 0 - #toolbar (the one right-anchored panel)
                // wraps horizontally instead of growing past its own
                // max-width (see styles.ts), so it never needs a right
                // inset. Kept as an explicit field, not hardcoded directly
                // in the return statement, so a FUTURE right-anchored
                // sidebar has an obvious place to add its own contribution.
                let left = 0;
                let right = 0;
                let top = 0;
                const bottom = 0;

                // P0 fix (final pre-release audit): #hint now carries the
                // "Module area" legend (area-legend, see template.ts/
                // styles.ts), which grows one row per area the scanned
                // project has - a project with a dozen areas can push
                // #hint's rendered height to several hundred px, taller
                // than many real viewports. #hint's WIDTH, unlike its
                // height, stays fixed (styles.ts: width: 300px) regardless
                // of legend length, so treating it as a LEFT inset (never
                // place graph content under #hint's own column, whatever
                // its height happens to be) protects the exact rectangle
                // #hint occupies without topInset below degenerating
                // toward - or past - the container's own height the
                // moment the legend grows tall. This replaces the old
                // "#hint is a short top bar" assumption (see the large
                // comment above this function) for #hint specifically;
                // #toolbar keeps contributing to topInset exactly as
                // before, since it's still true of #toolbar (anchored
                // top-right, wraps rather than growing tall).
                if (hint) {
                    left = Math.max(left, hint.right - containerRect.left);
                }
                if (toolbar) {
                    top = Math.max(top, toolbar.bottom - containerRect.top);
                }

                return { left, right, top, bottom };
            }

            // targetCollection is optional - Fit Graph, the initial-view
            // logic, and anything else that wants "whatever the
            // Area/Connections filter currently shows" can omit it and get
            // visibleElements(cy) as before. SCC focus below is the one
            // caller that passes something narrower (a specific SCC's own
            // members) - same chrome-avoiding fit math either way, just
            // aimed at a smaller collection, not a second implementation.
            function fitCyAvoidingChrome(cy, basePadding, targetCollection) {
                const container = cy.container();
                const insets = measureChromeInsets(container);

                const leftInset = Math.max(basePadding, insets.left + 16);
                const rightInset = Math.max(basePadding, insets.right + 16);
                const topInset = Math.max(basePadding, insets.top + 16);
                const bottomInset = Math.max(basePadding, insets.bottom + 16);

                const currentView = targetCollection || visibleElements(cy);
                const bb = currentView.boundingBox();

                if (bb.w === 0 || bb.h === 0) {
                    cy.fit(currentView, basePadding);
                    return;
                }

                // P0 fix (final pre-release audit): availableWidth/Height
                // used to be able to go negative or zero (chrome insets -
                // in practice a tall #hint - adding up to more than the
                // container itself), which fell through to a raw
                // cy.fit(currentView, basePadding) below: that call knows
                // nothing about #hint/#toolbar and centers on the WHOLE
                // container, putting the graph right back underneath the
                // chrome it's the entire point of this function to avoid
                // (the exact "graph ends up under the toolbar" failure the
                // audit reported). Clamping each dimension to a small
                // positive minimum instead means the safe-fit rectangle
                // can shrink but never collapses into that no-chrome
                // fallback - basePadding itself is already always >= 40 at
                // every real call site here, so this only ever bites in
                // pathological cases (e.g. a viewport narrower than #hint
                // itself), never in the tall-legend scenario the left-inset
                // fix above already handles directly.
                const minAvailable = Math.max(basePadding, 1);
                const availableWidth = Math.max(minAvailable, container.clientWidth - leftInset - rightInset);
                const availableHeight = Math.max(minAvailable, container.clientHeight - topInset - bottomInset);

                const zoom = Math.min(availableWidth / bb.w, availableHeight / bb.h);
                const safeCenterX = leftInset + availableWidth / 2;
                const safeCenterY = topInset + availableHeight / 2;

                cy.zoom(zoom);
                cy.pan({
                    x: safeCenterX - ((bb.x1 + bb.x2) / 2) * zoom,
                    y: safeCenterY - ((bb.y1 + bb.y2) / 2) * zoom,
                });
            }

            // UX fix (pre-existing, unrelated to Findings Phase 0/1/2 -
            // confirmed by reproducing the identical zoom/pan on master
            // before any of that work existed). This used to branch: a
            // graph that fit comfortably at a readable zoom got
            // fitCyAvoidingChrome(cy, 80) (the exact same call "Fit
            // Graph" makes), but one that didn't got cy.zoom(1) +
            // cy.center(currentView) instead - centering the WHOLE
            // bounding box's midpoint at 100% zoom. That second branch
            // was fine for a graph that's large in a roughly balanced
            // way, but breaks down for an extreme aspect ratio: a tall,
            // narrow vertical-flow layout (a hierarchical/rank-based
            // layout puts every member of a cycle on a different rank,
            // stretching the graph far taller than it is wide) has its
            // geometric center sitting in mostly empty vertical space,
            // so the very first thing a reader sees is a near-blank
            // viewport with one or two orphan-looking nodes - especially
            // noticeable now that the graph is no longer the report's
            // first screen (Findings Phase 1's "Explore full graph"
            // leads here). Always using the same fit-to-viewport logic
            // "Fit Graph" already uses removes the branch entirely
            // (rather than a second, parallel implementation) and makes
            // the very first view exactly what a reader would already
            // get by clicking "Fit Graph" themselves - never a
            // surprising, less-oriented default. The one real tradeoff,
            // accepted deliberately: a genuinely huge, dense graph (e.g.
            // dep-health's own ~400-module graph) now also starts at a
            // small "whole graph" overview zoom instead of a
            // readable-but-narrow-viewport one - matching the manual
            // "Fit Graph" button's own already-established behavior for
            // that same case, so this isn't a new tradeoff, just a
            // consistent one.
            function applyInitialView(cy) {
                fitCyAvoidingChrome(cy, 80);
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

            // Minimap viewport-rectangle bug fix (Graph UX pass). cy.extent()
            // (the model-space region the main canvas currently shows) is
            // computed purely from container size + zoom/pan - it has no
            // idea how big the graph's own content is. computeMinimapTransform()
            // above scales to fit the GRAPH's bounding box into the minimap,
            // which is a different, usually much smaller, box: a tall/narrow
            // hierarchical layout fit into a wide/short canvas (see
            // fitCyAvoidingChrome) is zoomed out far enough to satisfy its
            // HEIGHT, leaving its width nowhere near using the canvas's own
            // width - so cy.extent() ends up several times wider than the
            // graph's own content. Mapped through the minimap's transform
            // unclamped, that made the "you are here" rectangle extend well
            // past the minimap canvas's own physical edges: visually
            // meaningless when drawn (a box bigger than the map it's on),
            // and worse for isInsideViewportRect()'s hit-testing - once the
            // TRUE (unclamped) rectangle exceeded the 220x160 canvas, EVERY
            // click anywhere on the minimap fell "inside" it, silently
            // breaking "click empty minimap space to pan there" (drag-only
            // could still work, since it's relative-delta-based and never
            // consulted this rectangle's edges).
            //
            // Clamping to the minimap's own bounds is the correct fix, not
            // a cosmetic one: it's what makes the drawn rectangle and the
            // hit-test agree with what a 220x160 canvas can physically
            // show, degrades gracefully (a thin sliver at the relevant edge)
            // once the real viewport extends beyond the graph on one side,
            // and is the identity transform - no behavior change at all -
            // whenever the real viewport already fits inside the minimap,
            // which is most of the time on a graph with a more balanced
            // aspect ratio. Shared by both callers below so what's drawn and
            // what's clickable can never drift apart.
            function getMinimapViewportRect(cy) {
                if (!minimapTransform) {
                    return null;
                }

                const extent = cy.extent();
                const a = toMinimapPoint(extent.x1, extent.y1, minimapTransform);
                const b = toMinimapPoint(extent.x2, extent.y2, minimapTransform);

                return {
                    x1: Math.max(0, Math.min(MINIMAP_WIDTH, a.x)),
                    y1: Math.max(0, Math.min(MINIMAP_HEIGHT, a.y)),
                    x2: Math.max(0, Math.min(MINIMAP_WIDTH, b.x)),
                    y2: Math.max(0, Math.min(MINIMAP_HEIGHT, b.y)),
                };
            }

            function redrawMinimapViewport(cy) {
                if (!minimapCtx || !minimapTransform) {
                    return;
                }

                minimapCtx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
                minimapCtx.drawImage(minimapStatic, 0, 0);

                const rect = getMinimapViewportRect(cy);
                if (!rect) {
                    return;
                }

                minimapCtx.strokeStyle = '#2563eb';
                minimapCtx.lineWidth = 2;
                minimapCtx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);

                minimapCtx.fillStyle = 'rgba(37, 99, 235, 0.10)';
                minimapCtx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
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
                const rect = getMinimapViewportRect(cy);
                if (!rect) {
                    return false;
                }

                return mx >= rect.x1 && mx <= rect.x2 && my >= rect.y1 && my <= rect.y2;
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

                // 'cose' is the one layout here whose own physics can
                // leave two nodes overlapping each other (see
                // resolveNodeOverlaps's own comment) - every dagre-based
                // layout already keeps same-rank nodes apart by
                // construction, so this is deliberately scoped to 'cose'
                // only, not folded into the isCleanLayout branch above
                // (which is about a different problem - edges cutting
                // through unrelated nodes - and doesn't apply to 'cose' at
                // all, since it's not a CLEAN_LAYOUTS entry).
                if (layoutName === 'cose') {
                    resolveNodeOverlaps(cy);
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

            // Experimental (branch: experiment/cycle-map-v2, area filter).
            // Runs a layout on visibleElements(cy) - not cy.layout(), which
            // would run on the WHOLE graph regardless of the area filter -
            // so switching to e.g. 'core' actually recomputes positions for
            // only core's own nodes/edges, not the full graph with some of
            // it hidden afterward. Shared by the layout dropdown and the
            // area dropdown, since either one changing means "recompute
            // the currently-selected layout for whatever is visible now".
            function runLayoutForCurrentView(layoutName) {
                // A layout re-run (from the Layout dropdown directly, or
                // indirectly via an Area/Connections filter change - both
                // call this) moves nodes and/or changes which are visible,
                // so any active SCC focus's viewport framing and its
                // fade/highlight of "this SCC vs. everything else" would
                // otherwise be left referring to a graph that no longer
                // matches what's on screen - exit it rather than risk that
                // going stale/misleading.
                exitFocus();

                const runningLayout = visibleElements(cy).layout(layouts[layoutName]);

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

            const FOCUS_OVERFLOW_PROXY_ID = 'focus-overflow-proxy';

            // P0-1 fix. Focused Graph's own overflow-aggregation proxy -
            // the neighbour-selection counterpart to
            // addExternalConnectionProxies() above (same proxy node/edge
            // mechanism, same '.external-area-proxy'/'.external-proxy-edge'
            // classes and isExternalProxy data flag, so the existing
            // click-to-inspect panel, hiding/removal, and CSS all apply for
            // free), but grouped differently: a single shared bucket for
            // "every direct neighbour the FOCUS_NEIGHBOR_LIMIT cut left
            // out", not one bucket per area. Area-based grouping (like the
            // Area filter's own external connections) doesn't fit here -
            // Focus's whole point is "this cycle and its immediate
            // context", not "this cycle's relationship to other areas"
            // (that's an orthogonal, unrelated feature), and the excluded
            // neighbours can span many unrelated areas anyway. One proxy
            // NODE total keeps this from ever contributing to the node
            // explosion this fix exists to prevent; proxy EDGES are
            // deduplicated per (core member, direction) pair rather than
            // per real edge (unlike addExternalConnectionProxies, which
            // preserves one proxy edge per real crossing edge) - with
            // potentially hundreds of overflowing neighbours, only the
            // dedicated per-edge preservation would itself reintroduce the
            // exact node-count-adjacent blowup (hundreds of edge objects
            // into one node) this fix is meant to avoid, and the resulting
            // picture ("core member X has overflow neighbours feeding in/
            // out") is unchanged by collapsing duplicates.
            function addFocusOverflowProxies(cy, focus) {
                if (!focus.overflowNeighbourIds || focus.overflowNeighbourIds.size === 0) {
                    return;
                }

                const seenDirections = new Set();
                const proxyEdges = [];

                cy.edges().forEach((edge) => {
                    if (edge.data('isExternalProxy')) {
                        return;
                    }

                    const sourceId = edge.source().id();
                    const targetId = edge.target().id();
                    const sourceIsCore = focus.coreIds.has(sourceId);
                    const targetIsCore = focus.coreIds.has(targetId);

                    if (sourceIsCore === targetIsCore) {
                        return;
                    }

                    const outsideId = sourceIsCore ? targetId : sourceId;

                    if (!focus.overflowNeighbourIds.has(outsideId)) {
                        return;
                    }

                    const coreId = sourceIsCore ? sourceId : targetId;
                    const direction = sourceIsCore ? 'out' : 'in';
                    const dedupKey = coreId + '::' + direction;

                    if (seenDirections.has(dedupKey)) {
                        return;
                    }
                    seenDirections.add(dedupKey);

                    proxyEdges.push({
                        group: 'edges',
                        data: {
                            id: 'focus-overflow-edge::' + dedupKey,
                            source: direction === 'out' ? coreId : FOCUS_OVERFLOW_PROXY_ID,
                            target: direction === 'out' ? FOCUS_OVERFLOW_PROXY_ID : coreId,
                            isExternalProxy: true,
                            isFocusOverflowProxy: true,
                        },
                        classes: 'external-proxy-edge',
                    });
                });

                const dict = I18N_DICTIONARIES[currentLanguage];
                const overflowCount = focus.overflowNeighbourIds.size;

                cy.add({
                    group: 'nodes',
                    data: {
                        id: FOCUS_OVERFLOW_PROXY_ID,
                        label: formatI18nClient(dict.focusOverflowProxyLabel, { n: overflowCount }),
                        areaColor: '#9ca3af',
                        isExternalProxy: true,
                        isFocusOverflowProxy: true,
                        focusOverflowCount: overflowCount,
                    },
                    classes: 'external-area-proxy',
                });

                cy.add(proxyEdges);
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
                        node.toggleClass('not-in-view', !isNodeInCurrentView(node));
                        node.toggleClass('area-hidden', isNodeAreaFiltered(node));
                    });

                    cy.edges().forEach((edge) => {
                        edge.toggleClass('not-in-view', !isEdgeInCurrentView(edge));
                        edge.toggleClass('area-hidden', isEdgeAreaFiltered(edge));
                    });
                });

                // Focused Graph has no "external connections" concept of
                // its own (its node set is an explicit whitelist, not an
                // area) - the Area/Connections proxy mechanism below is
                // skipped while focused. It has its own aggregation need
                // instead (P0-1 fix): whatever direct neighbours didn't
                // make it into the FOCUS_NEIGHBOR_LIMIT cut get a single
                // shared summary proxy node here, reusing the exact same
                // proxy node/edge mechanism (and its
                // removeExternalConnectionProxies() cleanup, shared classes,
                // click-to-inspect panel) rather than a second, parallel
                // aggregation implementation.
                if (currentFocus) {
                    addFocusOverflowProxies(cy, currentFocus);
                } else if (currentAreaFilter && currentConnectionMode === 'external') {
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
                    // pick. Also forced disabled while Focused Graph is
                    // active (Layout/Area/Connections don't apply to a
                    // focused local view - see setFocusToolbarState()
                    // below), re-checked here too since refreshAreaView()
                    // itself runs as part of entering focus, after that
                    // same disabling already happened once.
                    connectionSelect.disabled = !currentAreaFilter || Boolean(currentFocus);
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

                    if (selectedNode.empty() || selectedNode.hasClass('not-in-view')) {
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
                        // "Fit Graph" means "show me everything currently
                        // visible" - which conflicts with an active SCC
                        // focus's fade (only the focused SCC at full
                        // opacity) still being applied underneath a
                        // now-full-graph viewport. Exit first so the two
                        // controls can't leave the report in a
                        // half-exited, visually confusing state.
                        exitFocus();
                        fitCyAvoidingChrome(cy, 40);
                    },
                );
            }

            // Experimental (branch: experiment/cycle-map-v2, educational
            // modal). General reference info, independent of node
            // selection - showModal()/close() are native <dialog> methods
            // (ESC-to-close and backdrop focus-trapping come for free from
            // the platform, no library needed to keep this a standalone
            // HTML file).
            const cycleInfoButton = document.getElementById('cycle-info-btn');
            const cycleInfoModal = document.getElementById('cycle-info-modal');
            const cycleInfoCloseButton = document.getElementById('cycle-info-close-btn');

            cycleInfoButton?.addEventListener('click', () => cycleInfoModal?.showModal());
            cycleInfoCloseButton?.addEventListener('click', () => cycleInfoModal?.close());

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

            // Bottom HUD's persistent "selected module" panel (center
            // section) - reuses the exact same node.data() fields the old
            // floating tooltip read (label/id/ca/ce/instability/sccSize),
            // just rendered into a fixed panel instead of following the
            // cursor. data.id is the full canonical path (never the
            // abbreviated on-node displayDir) - required so the HUD always
            // shows the complete path regardless of how short the node's
            // own label is. Presentation-only cleanup (Graph UX pass): this
            // panel no longer prints the Ca/Ce/Instability line - that's a
            // separate stability concept out of place on a screen about
            // exploring cycles/SCCs (see the #hud-help comment above for
            // the same reasoning). data.ca/data.ce/data.instability are
            // still present on every node's data() and untouched; only the
            // rendering here was trimmed, for a future dedicated stability
            // feature to pick back up. Only the "SCC size" label is
            // translated (it stays here - SCC membership is a cycles
            // concept, not a stability one).
            function updateSelectedModulePanel(node) {
                if (!hudSelectedBody) {
                    return;
                }

                const dict = I18N_DICTIONARIES[currentLanguage];

                if (!node) {
                    hudSelectedBody.className = 'hud-selected-empty';
                    hudSelectedBody.textContent = dict.hudSelectedEmptyText;
                    return;
                }

                const data = node.data();
                const title = data.label || data.id;

                hudSelectedBody.className = '';
                hudSelectedBody.innerHTML = \`
                    <strong>\${escapeHtml(title)}</strong><br />
                    <span class="hud-selected-path" dir="ltr">\${renderPathWithDirHighlight(data.id)}</span><br />
                    \${escapeHtml(dict.sccSizeLabel)}: \${data.sccSize ?? 0}
                    \${buildCycleContextHtml(node)}
                \`;
            }

            // Experimental (branch: experiment/cycle-map-v2, cycle node
            // details; terminology corrected under the SCC-vs-cycle fix;
            // member names made clickable under SCC member navigation).
            // Only ever appended for a node that's actually part of a real
            // (2+ member) SCC - sccSize/sccId are both unset for every
            // other node, so this correctly adds nothing for them ("no
            // artificial SCC details" for a module outside any SCC).
            // Reuses data(sccId) - the real SCC index
            // buildCytoscapeElements.ts already computes server-side - to
            // find the OTHER real members of the same SCC, rather than
            // re-deriving membership on the client (which would be
            // duplicating detection logic dep-health already ran once).
            //
            // IMPORTANT: an SCC is a group of mutually reachable modules,
            // not one single cycle - a non-trivial SCC is GUARANTEED to
            // contain at least one dependency cycle, but may contain
            // several distinct (possibly overlapping) cycles. This block
            // deliberately describes the SCC as a whole ("part of an
            // SCC of N modules", "other modules in this SCC") rather than
            // claiming the listed modules form one specific cycle -
            // nothing here computes an actual cycle path, and clicking a
            // member name below navigates to THAT MODULE, not to "the
            // cycle". Wording stays observational, never a verdict -
            // matches the educational modal's own framing (see
            // cycle-info-modal above): a detected SCC is a graph fact to
            // investigate, not something this report itself judges as a
            // problem.
            const MAX_SCC_MEMBERS_SHOWN = 12;

            function buildCycleContextHtml(node) {
                const dict = I18N_DICTIONARIES[currentLanguage];
                const data = node.data();

                if (!data.sccSize || data.sccSize < 2 || data.sccId === undefined) {
                    return '';
                }

                const otherMembers = cy
                    .nodes()
                    .filter((candidate) => candidate.data('sccId') === data.sccId && candidate.id() !== data.id);

                const shown = otherMembers.slice(0, MAX_SCC_MEMBERS_SHOWN);
                const remaining = otherMembers.length - shown.length;

                // Each shown member becomes a clickable name carrying the
                // real, stable cytoscape node id (a full canonical path,
                // never the display label) in a data attribute -
                // navigateToSccMember() below looks the node up by that id
                // via cy.getElementById(), never by matching label/path
                // text. Clicking a name here directly centers+selects it -
                // it never switches Focus - so this specifically needs
                // '.not-in-view' (is this member ACTUALLY on screen right
                // now, Focus included), not the narrower '.area-hidden' -
                // a member currently off-screen (hidden by the Area filter,
                // or excluded by a truncated Focus - see focusScc()'s
                // isRepresentativeOnly) is deliberately left non-clickable
                // with an explicit "(hidden by filter)" note instead:
                // clicking it would either do nothing (confusing - looks
                // broken) or select a node the user can't actually see on
                // screen (worse).
                const otherMembersHtml =
                    shown
                        .map((candidate) => {
                            const label = escapeHtml(candidate.data('label'));

                            if (candidate.hasClass('not-in-view')) {
                                // P1 fix (final pre-release audit): '.not-in-view' is true
                                // whenever Focus hides a member too, not just the Area/
                                // Connections filter - '.area-hidden' (Focus-independent,
                                // see isNodeAreaFiltered() above) is the one that actually
                                // tells the two apart, so the note shown must check it
                                // rather than always blaming "filter".
                                const hiddenNote = candidate.hasClass('area-hidden')
                                    ? dict.hiddenByFilterNote
                                    : dict.hiddenByFocusNote;
                                return \`<span class="hud-scc-member hud-scc-member-hidden">\${label} \${escapeHtml(hiddenNote)}</span>\`;
                            }

                            const id = escapeAttribute(candidate.id());

                            return \`<span class="hud-scc-member" data-scc-nav-id="\${id}">\${label}</span>\`;
                        })
                        .join(', ') +
                    (remaining > 0 ? escapeHtml(formatI18nClient(dict.moreCountSuffix, { n: remaining })) : '');

                // Experimental (branch: experiment/cycle-map-v2, SCC
                // focus). visibleMemberCount counts the SELECTED node
                // itself (always on-screen, or it couldn't have been
                // selected) plus every OTHER member not currently
                // '.area-hidden' - over the FULL otherMembers collection,
                // not just the (possibly truncated to
                // MAX_SCC_MEMBERS_SHOWN) "shown" list above, so the count
                // stays accurate even for an SCC with more members than
                // are individually listed. Never claims the whole SCC is
                // being focused when part of it is filtered out - the
                // button's own label says "of N" whenever the two differ,
                // and the button is omitted entirely (not just disabled)
                // once fewer than 2 members are actually visible, since
                // there'd be nothing left to see the SCC's shape through.
                //
                // P1-5 fix: deliberately '.area-hidden' (Area-filter-only),
                // NOT '.not-in-view' - this count feeds the "Focus SCC"
                // button below, which calls focusScc() directly. focusScc()
                // itself now computes its own candidate membership via
                // '.area-hidden' too (Focus-independent), so this count
                // must use the exact same predicate or the button could
                // claim a different visible-member count than focusScc()
                // actually finds once clicked - e.g. while already focused
                // on some OTHER, unrelated SCC, this selected node's own
                // SCC members are outside that unrelated focus but not
                // Area-hidden at all, and clicking the button correctly
                // switches Focus to them.
                const visibleMemberCount = 1 + otherMembers.filter((candidate) => !candidate.hasClass('area-hidden')).length;
                const focusCountSuffix =
                    visibleMemberCount < data.sccSize
                        ? formatI18nClient(dict.moduleCountVisibleParen, { visible: visibleMemberCount, n: data.sccSize })
                        : formatI18nClient(dict.moduleCountParen, { n: data.sccSize });
                const focusButtonHtml =
                    visibleMemberCount >= 2
                        ? \`<button type="button" class="hud-focus-scc-btn" data-focus-scc-id="\${data.sccId}" data-focus-start-id="\${escapeAttribute(data.id)}">\${escapeHtml(
                              dict.focusSccButton + ' ' + focusCountSuffix
                          )}</button>\`
                        : '';

                // Experimental (branch: experiment/cycle-map-v2, concrete
                // dependency cycle). Unlike Focus above, this is NOT gated
                // on visibleMemberCount - a concrete cycle is a fact about
                // the whole analyzed graph (openCycleDetailModal/
                // findCycleThroughNode below deliberately search over ALL
                // of this SCC's members, never just the ones the current
                // Area/Connections filter happens to show), so it stays
                // available even if every other member is currently
                // hidden; the modal itself is what honestly reports how
                // much of the found cycle is actually on screen right now.
                // Carries the SELECTED node's own id (not the SCC's id) -
                // the whole point is "a cycle through THIS module", not
                // just any cycle inside its SCC.
                const cycleButtonHtml = \`<button type="button" class="hud-cycle-detail-btn" data-show-cycle-node-id="\${escapeAttribute(data.id)}">\${escapeHtml(dict.showDependencyCycleButton)}</button>\`;

                // Not escapeHtml()'d - dict.sccContextPartOf is trusted,
                // translator-authored template text, and for French/
                // Spanish/Portuguese it embeds a real &deg;/&ordm; entity
                // (matching sccLabel's own precedent elsewhere in this
                // dictionary) that escapeHtml() would otherwise turn into
                // the literal, broken text "&amp;deg;".
                const partOfText = formatI18nClient(dict.sccContextPartOf, { id: data.sccId + 1, n: data.sccSize });
                const otherMembersLine = otherMembersHtml
                    ? dict.sccContextOtherMembers + ' ' + otherMembersHtml + '.'
                    : '';

                return \`
                    <br />
                    <span class="hud-cycle-context">
                        \${partOfText}
                        \${dict.sccContextContainsCycles}
                        \${otherMembersLine}
                        <br />
                        \${focusButtonHtml}
                        \${cycleButtonHtml}
                    </span>
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

                const dict = I18N_DICTIONARIES[currentLanguage];
                const data = node.data();
                const connectionCount = node.connectedEdges().length;

                hudSelectedBody.className = '';

                // P0-1 fix. Focus's own overflow-summary proxy (see
                // addFocusOverflowProxies() above) reuses this same panel
                // function/mechanism, but needs different wording - "External
                // area: %name" doesn't apply to it - so it branches here
                // instead of getting a second, parallel panel-rendering
                // function. currentFocus is guaranteed non-null while this
                // proxy exists (it's only ever added/removed alongside
                // focus itself), so its own neighboursShown/Total counts
                // are always available for the "%visible of %n" wording.
                if (data.isFocusOverflowProxy) {
                    hudSelectedBody.innerHTML = \`
                        <strong>\${escapeHtml(formatI18nClient(dict.focusOverflowProxyLabel, { n: data.focusOverflowCount }))}</strong><br />
                        <span class="hud-selected-path">\${escapeHtml(formatI18nClient(dict.focusOverflowPanelBody, {
                            visible: currentFocus.neighborsShownCount,
                            n: currentFocus.neighborsTotalCount,
                            hidden: data.focusOverflowCount,
                        }))}</span><br />
                        \${escapeHtml(formatI18nClient(dict.externalAreaConnectionsShown, { n: connectionCount }))}
                    \`;
                    return;
                }

                // Format with the RAW area name, then escape the whole
                // composed sentence once - escaping data.label first and
                // then escaping the composed string again would
                // double-escape it (e.g. an "&" in a folder name).
                hudSelectedBody.innerHTML = \`
                    <strong>\${escapeHtml(formatI18nClient(dict.externalAreaLabel, { name: data.label }))}</strong><br />
                    <span class="hud-selected-path">\${escapeHtml(formatI18nClient(dict.externalAreaAggregatedView, { name: data.label }))}</span><br />
                    \${escapeHtml(formatI18nClient(dict.externalAreaConnectionsShown, { n: connectionCount }))}
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

            // Experimental (branch: experiment/cycle-map-v2, SCC member
            // navigation). The exact same selection mechanics a plain
            // click on a graph node already ran (moved here unchanged, not
            // reimplemented) - the one and only place selectedNodeId is
            // ever set to a real node's id, so both a direct graph click
            // and clicking a member name inside the HUD's own "Other
            // modules in this SCC" list end up in identical selected
            // state, per the existing observational (never a verdict)
            // framing either way.
            function selectNode(node) {
                const data = node.data();

                selectedNodeId = data.id;

                // clearHighlights() also strips any previous node's
                // '.selected' marker - always needs to run once per
                // selection (highlightNeighborhood already does this
                // itself when highlighting is on) so a stale border can't
                // linger on the previously-selected node when the toggle
                // is off.
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
            }

            // Experimental (branch: experiment/cycle-map-v2, SCC member
            // navigation). Looks the target up by its real, stable
            // cytoscape node id (never by label/path text) via
            // cy.getElementById() - the same lookup mechanism
            // buildCycleContextHtml above already uses to find SCC
            // members, not a new id/name-matching scheme. Re-checks
            // '.not-in-view' defensively (buildCycleContextHtml already
            // only renders an on-screen member as clickable, matching this
            // exact check, so this should be unreachable in practice)
            // rather than trusting the HTML that was rendered at some
            // earlier point hasn't gone stale if a filter/Focus changed in
            // between - cy.center()+selectNode() below need a node that's
            // genuinely on screen, not just one the Area filter alone
            // wouldn't hide.
            function navigateToSccMember(nodeId) {
                const node = cy.getElementById(nodeId);

                if (node.empty() || node.hasClass('not-in-view')) {
                    return;
                }

                cy.center(node);
                selectNode(node);
            }

            // Local/Focused-graph UX pass. currentFocus itself is declared
            // up with isNodeInCurrentView()/isEdgeInCurrentView() (see
            // their own comments) - both of those, and therefore
            // visibleNodes()/visibleEdges()/visibleElements() and
            // everything built on them (layout-on-visible, fit, minimap),
            // are already focus-aware, which is what lets focusScc() below
            // be a thin layer on top of the SAME machinery the
            // Area/Connections filter already uses, rather than a second,
            // parallel "filtered graph" implementation.
            const showFullGraphButton = document.getElementById('show-full-graph-btn');
            const focusStatusEl = document.getElementById('focus-status');
            let preFocusSnapshot = null;

            // P2 fix: runFocusLayout()'s cose layout runs with animate:
            // true (~1.7-2.6s), so exitFocus() can be triggered (Show full
            // graph, Fit Graph, or a layout/area change re-entering
            // runLayoutForCurrentView()) while it's still mid-animation.
            // Tracks whichever focus layout run is currently "live" so
            // exitFocus() can tell it apart from one that's already
            // finished, and so its own 'layoutstop' handler (below, in
            // runFocusLayout()) can recognise a run that exitFocus() has
            // since abandoned and skip acting on it entirely.
            let activeFocusLayout = null;

            // Above this many real SCC members, Focused Graph shows a
            // representative concrete cycle (via findCycleThroughNode() -
            // the exact same deterministic per-click search the
            // concrete-cycle modal already uses, not a second "pick a
            // cycle" algorithm) plus that cycle's own direct neighbours,
            // instead of laying out the whole SCC. Chosen directly from the
            // task's own worked examples (7 members: show all; 40: show
            // all if the layout stays readable; 1000: don't) - a margin
            // above "40 is still fine", comfortably below "1000 is not".
            const FOCUS_FULL_SCC_MAX = 40;

            // P0-1 fix (pre-v0.10.2 audit): the SCC/cycle's own 1-hop
            // neighbourhood (computed below in focusScc()) used to be shown
            // in full, with no limit - a widely-imported module (a shared
            // logger/config pair hundreds of other modules import) can have
            // hundreds of direct neighbours, silently ballooning "focus on
            // this one cycle" into nearly the whole project graph. Chosen
            // on the same order of magnitude as FOCUS_FULL_SCC_MAX just
            // above (40 core members was already judged "still fine" for
            // this view's compact force-directed layout), but a little
            // lower - neighbours are supplementary context around the
            // cycle, not the structural subject of the view, so they get a
            // smaller share of the node budget. Even in the worst case
            // (a huge SCC falling back to its FOCUS_FULL_SCC_MAX-sized
            // representative cycle), 40 core + 30 neighbours = 70 nodes
            // stays comfortably inside the range 'cose' already handles
            // well. For the overwhelming common case - a 2-5 member cycle
            // with a handful of neighbours - this limit is never
            // approached, so ordinary small-cycle Focused Graph UX is
            // completely unaffected.
            const FOCUS_NEIGHBOR_LIMIT = 30;

            // selectFocusNeighbours() (ranks candidate neighbours - first by
            // how many distinct core members they connect to, then by raw
            // edge count, then by a fixed deterministic id tie-break, never
            // by cytoscape's own collection iteration order) is defined and
            // unit-tested in its own real, framework-free module
            // (focusNeighbourSelection.ts) rather than written inline here,
            // so it can be executed directly with plain data in Jest - real
            // behavioral coverage of the actual algorithm, not an assertion
            // that some substring appears in this generated HTML. Its
            // source is embedded verbatim below (via .toString()) so the
            // exact function those tests exercise is the exact function
            // that runs in the browser - no separate, potentially
            // drifting, client-side reimplementation.
            ${selectFocusNeighbours.toString()}

            // Layout/Area/Connections all describe the FULL graph's own
            // structure/filtering - none of them apply to a deliberately
            // narrowed local view, so all three are disabled (not hidden -
            // "not applicable right now", not "gone") while focused. Mirrors
            // how connectionSelect is already disabled whenever Area =
            // 'All', for the identical reason (nothing for it to do).
            function setFocusToolbarState(isFocused) {
                if (layoutSelect) {
                    layoutSelect.disabled = isFocused;
                }
                if (areaSelect) {
                    areaSelect.disabled = isFocused;
                }
                if (connectionSelect && isFocused) {
                    connectionSelect.disabled = true;
                }
            }

            // The exit button's own label always carries the same "(X of Y
            // modules)" count the HUD's own Focus SCC button already showed
            // before Focus was entered - reusing moduleCountParen/
            // moduleCountVisibleParen (no new dictionary key needed for
            // this part). X is how many of the SCC's real members the
            // focused view's core actually is (the whole SCC, or just the
            // representative cycle - see focusScc() below); Y is the SCC's
            // total size. This count is deliberately about the CORE only,
            // not the whole focused view - #focus-status (below) is the
            // honest disclosure of everything the core count alone doesn't
            // say: a representative-cycle truncation (FOCUS_FULL_SCC_MAX)
            // and/or a neighbour-count truncation (P0-1 fix,
            // FOCUS_NEIGHBOR_LIMIT). Before the P0-1 fix, neighbours were
            // unbounded and totally undisclosed here - a huge fan-in/fan-out
            // module's cycle could show "(2 of 2 modules)" while actually
            // rendering hundreds of neighbour nodes, which read as "this is
            // the entire focused view" even though it very much wasn't.
            // Both notes appear together, space-joined, when both apply.
            // Re-run verbatim from applyLanguage()'s own dynamic-content
            // re-render block so switching language while focused keeps
            // all of this in sync too.
            function updateFocusToolbarLabels() {
                if (!currentFocus) {
                    return;
                }

                const dict = I18N_DICTIONARIES[currentLanguage];

                if (showFullGraphButton) {
                    const countSuffix =
                        currentFocus.shownCoreCount < currentFocus.totalSize
                            ? formatI18nClient(dict.moduleCountVisibleParen, {
                                  visible: currentFocus.shownCoreCount,
                                  n: currentFocus.totalSize,
                              })
                            : formatI18nClient(dict.moduleCountParen, { n: currentFocus.totalSize });
                    showFullGraphButton.textContent = dict.showFullGraphButton + ' ' + countSuffix;
                }

                if (focusStatusEl) {
                    const notes = [];

                    if (currentFocus.isRepresentativeOnly) {
                        notes.push(formatI18nClient(dict.focusRepresentativeNote, { n: currentFocus.totalSize }));
                    }

                    if (currentFocus.overflowNeighbourIds.size > 0) {
                        notes.push(
                            formatI18nClient(dict.focusNeighborsTruncatedNote, {
                                visible: currentFocus.neighborsShownCount,
                                n: currentFocus.neighborsTotalCount,
                            }),
                        );
                    }

                    focusStatusEl.hidden = notes.length === 0;
                    focusStatusEl.textContent = notes.join(' ');
                }
            }

            // Runs the existing Force Directed layout (layouts.cose,
            // reused exactly as-is - per the task's own explicit preference
            // for an existing layout over inventing a new one) on whatever
            // visibleElements(cy) currently is - during focus, that's
            // exactly the focused node set, since isNodeInCurrentView()/
            // isEdgeInCurrentView() already check currentFocus first.
            // randomize: false starts the simulation from each node's
            // CURRENT position (inherited from the last full-graph layout,
            // itself deterministic) instead of cytoscape-cose's own default
            // random scatter - far more reproducible in practice than
            // starting from scratch every time, and avoids a jarring
            // scatter-to-settle animation from a visually arbitrary start.
            // onLayoutFinished(cy, 'cose') (unchanged, reused exactly as
            // every other layout already uses it) handles the rest:
            // turning off taxi edge routing (cose draws plain straight
            // edges), skipping wrapWideRanks/resolveEdgeNodeOverlaps
            // (neither applies - 'cose' is not a CLEAN_LAYOUTS entry),
            // fitting the viewport to visibleElements(cy) (the focused set
            // again), and redrawing the minimap.
            function runFocusLayout() {
                const focusLayoutConfig = Object.assign({}, layouts.cose, { randomize: false });
                const runningLayout = visibleElements(cy).layout(focusLayoutConfig);
                activeFocusLayout = runningLayout;

                runningLayout.one('layoutstop', () => {
                    // exitFocus() clears activeFocusLayout (and calls
                    // .stop() on this exact layout object) the moment
                    // Focus is exited mid-animation - if that already
                    // happened, this is either that same .stop() call's
                    // own synchronous 'layoutstop' emission, or cose's
                    // late natural one; either way, onLayoutFinished(cy,
                    // 'cose') must not run against whatever view is
                    // showing by then (Full Graph, a different layout,
                    // possibly a different SCC's Focus).
                    if (activeFocusLayout !== runningLayout) {
                        return;
                    }

                    activeFocusLayout = null;

                    // F8 fix: the overflow proxy (addFocusOverflowProxies())
                    // is added to cy AFTER currentFocus.nodeIds was computed
                    // in focusScc(), so isNodeInCurrentView() never counted
                    // it as part of the focused view - it was excluded from
                    // the cose run just above (visibleElements(cy) at the
                    // top of this function) and from onLayoutFinished's own
                    // fit (applyInitialView() -> fitCyAvoidingChrome(cy, 80),
                    // also keyed off visibleElements(cy)), leaving it at
                    // cytoscape's own default (0, 0) - see AUDIT_v0.11.0.md
                    // F8. Placed at the now-settled core's centroid and
                    // folded into currentFocus.nodeIds here, right before
                    // onLayoutFinished(cy, 'cose') below, so it both starts
                    // out next to the cycle it summarizes and is included in
                    // that same fit. Two single-axis position(name, value)
                    // calls, not one object-valued position(pos) call -
                    // confirmed directly (this fix's own behavioral test)
                    // that only the single-axis form reliably moves a node
                    // added via cy.add() after construction.
                    const overflowProxy = cy.getElementById(FOCUS_OVERFLOW_PROXY_ID);

                    if (currentFocus && !overflowProxy.empty()) {
                        const coreNodes = cy.nodes().filter((node) => currentFocus.coreIds.has(node.id()));
                        const centroid = coreNodes.reduce(
                            (acc, node) => {
                                const pos = node.position();
                                return { x: acc.x + pos.x, y: acc.y + pos.y };
                            },
                            { x: 0, y: 0 },
                        );

                        overflowProxy.position('x', centroid.x / coreNodes.length);
                        overflowProxy.position('y', centroid.y / coreNodes.length);
                        currentFocus.nodeIds.add(FOCUS_OVERFLOW_PROXY_ID);
                    }

                    onLayoutFinished(cy, 'cose');
                });

                runningLayout.run();
            }

            // "Purpose over algorithm name" (per the task's own framing):
            // Focused Graph's job is "show me this structural finding, not
            // the whole project" - a REAL subgraph (nodes/edges outside it
            // hidden via '.not-in-view', the same display mechanism the
            // Area/Connections filter already uses, not a fade-in-place
            // over the full graph the way this function used to work),
            // laid out with the existing compact Force Directed layout
            // instead of the Full Graph's own strict hierarchical one.
            // startId is the node the user actually triggered Focus from
            // (the HUD's own selected module, or the concrete-cycle
            // modal's own node) - both call sites now pass it explicitly;
            // see their own comments for why it's needed here (choosing
            // which representative cycle to show for a huge SCC).
            //
            // P1-5 fix: allMembers is filtered by '.area-hidden' - the
            // Area/Connections filter alone, deliberately ignoring whatever
            // currentFocus currently is (isNodeAreaFiltered() above).
            // Before this fix it used the combined "not in current view"
            // state instead, so calling focusScc() for a DIFFERENT SCC
            // while already focused on some other one saw every member of
            // the NEW target as hidden (they were outside the OLD focus,
            // nothing to do with Area) - allMembers.length came back 0 and
            // this returned early, silently doing nothing. Switching Focus
            // directly from one SCC to another (e.g. Findings -> "View
            // cycle" -> "Show in graph" for a different finding) now works
            // exactly like starting Focus fresh from the Full Graph.
            function focusScc(sccId, startId) {
                const allMembers = cy.nodes().filter(
                    (candidate) => candidate.data('sccId') === sccId && !candidate.hasClass('area-hidden'),
                );

                if (allMembers.length < 2) {
                    return;
                }

                // Snapshot the exact pre-focus state ONCE, the first time
                // focus is entered - re-focusing a DIFFERENT SCC/cycle
                // while already focused (e.g. clicking a neighbour's own
                // Focus SCC button) must still restore the ORIGINAL Full
                // Graph state on exit, not an intermediate focused one.
                //
                // Bug fix (viewport pass): cy.pan() returns cytoscape's
                // OWN internal pan object by reference, not a defensive
                // copy - confirmed directly (two calls return the exact
                // same object; mutating via cy.pan({...}) changes what an
                // earlier-captured reference reads too). Without
                // Object.assign({}, ...) here, this "snapshot" was really
                // just an alias to cytoscape's live pan state, so the very
                // next fitCyAvoidingChrome() call inside runFocusLayout()
                // (which repositions the view for the focused subgraph)
                // silently overwrote the snapshot in place - exitFocus()
                // was then "restoring" pan to wherever focus itself had
                // just panned to, not to the real pre-focus position.
                // zoom didn't need this: cy.zoom() returns a primitive
                // number, which is copied by value automatically. node.
                // position() has the identical live-reference risk, which
                // is why the positions map below already wraps each one
                // in Object.assign({}, ...) - pan just hadn't gotten the
                // same treatment.
                if (!currentFocus) {
                    preFocusSnapshot = {
                        zoom: cy.zoom(),
                        pan: Object.assign({}, cy.pan()),
                        positions: new Map(cy.nodes().map((node) => [node.id(), Object.assign({}, node.position())])),
                    };
                }

                let coreMembers = allMembers;
                let isRepresentativeOnly = false;

                if (allMembers.length > FOCUS_FULL_SCC_MAX) {
                    const startCandidate = startId ? cy.getElementById(startId) : null;
                    const resolvedStartId =
                        startCandidate && !startCandidate.empty() && !startCandidate.hasClass('area-hidden')
                            ? startId
                            : allMembers[0].id();
                    const path = findCycleThroughNode(sccId, resolvedStartId);

                    if (path) {
                        // F5 fix: findCycleThroughNode returns the SHORTEST
                        // cycle through resolvedStartId - for a ring-shaped
                        // SCC (no shorter cycle exists than the whole ring),
                        // that "representative cycle" is every single
                        // member, so taking it as-is left FOCUS_FULL_SCC_MAX
                        // meaningless: a 50-member ring rendered all 50 nodes
                        // at once (AUDIT_v0.11.0.md F5). openPath[0] is
                        // always resolvedStartId (findCycleThroughNode
                        // returns [startId, ...pathBackToStartId]), so
                        // slicing to the first FOCUS_FULL_SCC_MAX entries
                        // keeps a contiguous walk starting at the node the
                        // user actually triggered Focus from.
                        const openPath = path.slice(0, -1);
                        const truncatedPath = openPath.slice(0, FOCUS_FULL_SCC_MAX);
                        const pathIds = new Set(truncatedPath);
                        coreMembers = allMembers.filter((node) => pathIds.has(node.id()));
                        isRepresentativeOnly = true;
                    }
                }

                const coreIds = new Set(coreMembers.map((node) => node.id()));

                // P0-1 fix: the SCC/cycle's own 1-hop neighbourhood used to
                // be taken in full (coreMembers.neighborhood('node')) with
                // no limit - see FOCUS_NEIGHBOR_LIMIT's own comment above
                // for why that's a real problem, not a hypothetical one.
                // Candidates are derived directly from the edges touching
                // coreMembers (never cytoscape's own .neighborhood()
                // iteration order - selectFocusNeighbours() re-derives its
                // own ranking from these {source, target} pairs instead),
                // excluding anything hidden by the Area filter specifically
                // (the ':area-hidden' check - Focus-independent, same
                // reasoning as allMembers above) or itself a proxy (a proxy
                // is a presentation-only artifact of a DIFFERENT filter,
                // never a real neighbour candidate).
                const neighbourEdgeRefs = cy
                    .edges()
                    .filter((edge) => {
                        if (edge.hasClass('area-hidden') || edge.data('isExternalProxy')) {
                            return false;
                        }

                        const sourceIsCore = coreIds.has(edge.source().id());
                        const targetIsCore = coreIds.has(edge.target().id());

                        if (sourceIsCore === targetIsCore) {
                            return false;
                        }

                        const outsideNode = sourceIsCore ? edge.target() : edge.source();
                        return !outsideNode.hasClass('area-hidden');
                    })
                    .map((edge) => ({ source: edge.source().id(), target: edge.target().id() }));

                const neighbourSelection = selectFocusNeighbours(
                    Array.from(coreIds),
                    neighbourEdgeRefs,
                    FOCUS_NEIGHBOR_LIMIT,
                );
                const shownNeighbourIds = new Set(neighbourSelection.shown);
                const overflowNeighbourIds = new Set(neighbourSelection.overflow);
                const neighbours = cy.nodes().filter((node) => shownNeighbourIds.has(node.id()));

                const focusNodeIds = new Set(coreMembers.union(neighbours).map((node) => node.id()));

                currentFocus = {
                    sccId,
                    nodeIds: focusNodeIds,
                    totalSize: allMembers.length,
                    shownCoreCount: coreMembers.length,
                    isRepresentativeOnly,
                    // P0-1 fix: coreIds/overflowNeighbourIds are read back
                    // by addFocusOverflowProxies() (refreshAreaView() below
                    // calls it while currentFocus is set) to build the
                    // overflow summary proxy; neighborsShownCount/
                    // neighborsTotalCount feed updateFocusToolbarLabels()'s
                    // honest disclosure of the truncation, if any.
                    coreIds,
                    overflowNeighbourIds,
                    neighborsShownCount: shownNeighbourIds.size,
                    neighborsTotalCount: shownNeighbourIds.size + overflowNeighbourIds.size,
                };

                clearHighlights();
                refreshAreaView();

                cy.nodes().removeClass('focus-neighbor');
                neighbours.addClass('focus-neighbor');

                // P1-4 fix: this used to just addClass('selected') and set
                // selectedNodeId directly - a partial, hand-rolled copy of
                // what selectNode() already does, missing the one part
                // that actually matters here: it never called
                // updateSelectedModulePanel(), so the HUD's own Selected
                // module panel stayed empty (or stale, showing whatever was
                // selected before Focus started) even though a node
                // visibly got the '.selected' border. Reusing selectNode()
                // outright - never a second, partial selection
                // implementation - fixes that and comes with
                // highlightNeighborhood()/clearHighlights() for free, the
                // same as any other selection change. Falls back to
                // coreMembers[0] not just when startId is missing/removed
                // but also when it resolved to a node OUTSIDE the focus set
                // just computed (focusNodeIds) - startId can be stale (e.g.
                // the concrete-cycle modal's own start id from before this
                // exact SCC's allMembers got Area-filtered down) and
                // selecting a node this view doesn't actually contain would
                // reintroduce the same "selected something you can't see"
                // problem this fix exists to prevent.
                const startNode = startId ? cy.getElementById(startId) : null;
                const resolvedSelected =
                    startNode && !startNode.empty() && focusNodeIds.has(startNode.id())
                        ? startNode
                        : coreMembers[0];
                selectNode(resolvedSelected);

                setFocusToolbarState(true);

                if (showFullGraphButton) {
                    showFullGraphButton.hidden = false;
                }

                updateFocusToolbarLabels();
                runFocusLayout();
            }

            // Restores the exact pre-focus state - not just "unhide
            // everything and re-fit", but the SAME node positions/zoom/pan
            // Full Graph had before Focus ran its own compact layout, so
            // returning never looks like a surprise re-layout of the whole
            // project graph. The Area/Connections filter and Layout
            // selection were never touched while focused (currentFocus
            // takes precedence over them in isNodeInCurrentView()/
            // isEdgeInCurrentView() instead of replacing them), so they're
            // already correct the moment refreshAreaView() below re-derives
            // visibility straight from that untouched state.
            function exitFocus() {
                if (currentFocus === null) {
                    return;
                }

                currentFocus = null;

                // P2 fix: runFocusLayout()'s cose layout runs with
                // animate: true (~1.7-2.6s) and exitFocus() can run
                // (Show full graph, Fit Graph, or a programmatic call)
                // while it's still mid-animation - left running, it kept
                // repositioning its own frozen node set every remaining
                // animation frame, then its late 'layoutstop' fired
                // onLayoutFinished(cy, 'cose') against whatever view is
                // showing by then (Full Graph here), wiping every edge's
                // taxi-routing class graph-wide and re-fitting to the
                // wrong thing. Nulling activeFocusLayout first marks this
                // run stale for its own 'layoutstop' handler in
                // runFocusLayout() (above), so that handler's
                // onLayoutFinished(cy, 'cose') call never fires for it,
                // whether triggered by the .stop() call below or by the
                // layout's own later natural finish.
                const abortedFocusLayout = activeFocusLayout;
                activeFocusLayout = null;

                if (abortedFocusLayout) {
                    // Cytoscape's CoseLayout.stop() always lets one more
                    // already-queued animation frame run the layout's
                    // normal end-of-run pass (repositioning its own
                    // frozen node set - layouts.cose already sets
                    // fit: false, so no extra cy.fit() call rides along)
                    // - true whether the layout stopped early or
                    // converged naturally, and not something .stop()
                    // itself can skip. The requestAnimationFrame callback
                    // near the end of this function corrects that
                    // trailing reposition.
                    abortedFocusLayout.stop();
                }

                if (showFullGraphButton) {
                    showFullGraphButton.hidden = true;
                }

                if (focusStatusEl) {
                    focusStatusEl.hidden = true;
                }

                setFocusToolbarState(false);

                cy.nodes().removeClass('focus-neighbor');

                // Restores the curve-style classes the Full Graph's own
                // currently-selected layout expects - runFocusLayout()'s
                // own onLayoutFinished(cy, 'cose') call turned these off
                // (cose draws plain straight edges) across the WHOLE graph,
                // not just the focused subset, since that toggle has always
                // operated on cy.edges() (every edge, visible or not)
                // rather than visibleElements(cy) - restoring it here the
                // same way is what keeps a hidden, about-to-reappear
                // taxi-routed edge correct again.
                const fullGraphLayoutName = layoutSelect ? layoutSelect.value : 'flowVertical';
                const axis = ORTHOGONAL_LAYOUT_AXES[fullGraphLayoutName] || null;
                cy.edges().toggleClass('orthogonal-edge-vertical', axis === 'vertical');
                cy.edges().toggleClass('orthogonal-edge-horizontal', axis === 'horizontal');

                refreshAreaView();

                // Captured before preFocusSnapshot is nulled below, purely
                // so the requestAnimationFrame callback further down (which
                // fires after this function has already returned) still has
                // it to reapply.
                const snapshotForDeferredReapply = preFocusSnapshot;

                if (preFocusSnapshot) {
                    cy.batch(() => {
                        preFocusSnapshot.positions.forEach((pos, id) => {
                            const node = cy.getElementById(id);
                            if (!node.empty()) {
                                node.position(pos);
                            }
                        });
                    });
                    cy.zoom(preFocusSnapshot.zoom);
                    cy.pan(preFocusSnapshot.pan);
                    preFocusSnapshot = null;
                }

                redrawMinimapStatic(cy, axis);

                // P2 fix (continued): queued strictly after the aborted
                // layout's own guaranteed trailing reposition pass (see
                // the .stop() comment above) - browsers run
                // requestAnimationFrame callbacks in request order, and
                // that trailing pass was already queued, by the layout's
                // own still-pending animation frame, before this one is
                // requested here, so this always runs after it and undoes
                // whatever it just overwrote. Reapplies node positions
                // only, never pan/zoom, so it can't fight a synchronous
                // fit a caller performs right after exitFocus() returns
                // (e.g. the Fit Graph button's own fitCyAvoidingChrome()
                // call). Guarded by currentFocus still being null in case
                // a new Focus was entered again before this frame runs -
                // that new Focus's own nodes/positions must win, not this
                // stale snapshot.
                if (abortedFocusLayout && snapshotForDeferredReapply) {
                    requestAnimationFrame(() => {
                        if (currentFocus !== null) {
                            return;
                        }

                        cy.batch(() => {
                            snapshotForDeferredReapply.positions.forEach((pos, id) => {
                                const node = cy.getElementById(id);
                                if (!node.empty()) {
                                    node.position(pos);
                                }
                            });
                        });
                        redrawMinimapStatic(cy, axis);
                    });
                }

                const selectedNode = selectedNodeId ? cy.getElementById(selectedNodeId) : null;

                // refreshAreaView() just ran above, so '.not-in-view' here
                // already reflects the restored (currentFocus === null)
                // Full Graph/Area-filtered state - the "is this node still
                // genuinely on screen" question, not the narrower
                // Area-only one.
                if (selectedNode && !selectedNode.empty() && !selectedNode.hasClass('not-in-view')) {
                    // P1-4 fix (same root cause/fix as focusScc() above):
                    // this used to only restore the highlight+'.selected'
                    // marker by hand, never calling
                    // updateSelectedModulePanel() - so the HUD panel could
                    // keep showing stale Focus-button visible-counts/hidden
                    // notes computed while Focus was still active, even
                    // though refreshAreaView() just above already changed
                    // what '.area-hidden' means for every other member of
                    // this node's own SCC. selectNode() recomputes that
                    // panel fresh against the just-restored Full Graph/Area
                    // state, for free, the same as any other selection
                    // change - never a second, partial selection
                    // implementation.
                    selectNode(selectedNode);
                } else {
                    selectedNodeId = null;
                    clearHighlights();
                    updateSelectedModulePanel(null);
                }
            }

            // exitFocus() itself already restores the exact pre-focus
            // zoom/pan (see its own comment) - no separate re-fit call
            // here, which would just override that restore with a fresh
            // "fit the whole graph" view instead of the one the user had
            // before entering Focus.
            showFullGraphButton?.addEventListener('click', () => {
                exitFocus();
            });

            // Event delegation, not a listener per rendered name: the HUD
            // panel's innerHTML (and every element inside it, including
            // any .hud-scc-member spans and the Focus SCC button) is fully
            // replaced on every selection change, which would silently
            // drop per-element listeners - one listener on the panel
            // itself, attached once, keeps working across any number of
            // re-renders.
            hudSelectedBody?.addEventListener('click', (event) => {
                const focusEl = event.target.closest('[data-focus-scc-id]');

                if (focusEl) {
                    focusScc(Number(focusEl.dataset.focusSccId), focusEl.dataset.focusStartId);
                    return;
                }

                const memberEl = event.target.closest('[data-scc-nav-id]');

                if (!memberEl) {
                    return;
                }

                navigateToSccMember(memberEl.dataset.sccNavId);
            });

            // Experimental (branch: experiment/cycle-map-v2, concrete
            // dependency cycle). An SCC only says WHICH modules are
            // mutually reachable - not HOW the dependencies actually loop
            // back. This finds ONE concrete, ordered directed cycle
            // through a specific member, using only data already embedded
            // in this report (cy.nodes()/cy.edges() over the WHOLE
            // analyzed graph - never visibleElements(cy) - a cycle is a
            // fact about the whole dependency graph, not about whatever
            // the current Area/Connections filter happens to be showing
            // right now).
            //
            // Deliberately NOT the analyzer core's own detectCycles(): that
            // function enumerates cycles opportunistically with a single
            // visited set shared across every DFS seed, so a node already
            // consumed by an earlier, unrelated cycle can silently never
            // come back as the start of its OWN cycle - the exact opposite
            // of "a cycle through THIS module" (see
            // src/features/cycles/analyzeCycles.ts's own comment on this
            // exact undercount). This is a fresh, small, per-click search
            // instead, scoped to just the selected node's own SCC members
            // (via the already-known sccId - never re-running SCC
            // detection itself), so its cost is bounded by that SCC's own
            // size, not the whole graph, and is never a combinatorial
            // enumeration of every possible cycle: from the selected node,
            // step to its first neighbor (in a fixed, sorted order - the
            // one and only deterministic choice made here), then run a
            // plain breadth-first search back to the start. BFS visits
            // each node at most once, so this is a strict O(members +
            // internal edges) - no exponential blowup even on a large,
            // densely-interconnected SCC (unlike a naive DFS that only
            // prunes already-on-the-current-path nodes, which can
            // re-explore the same alternate routes many times over before
            // finding the one that closes the loop). Not recursive, either
            // - the codebase's existing recursive cycle DFS
            // (detectCycles.ts/metrics/dfs.ts, both untouched by this
            // feature) has a known stack-overflow risk on pathologically
            // deep chains (see docs/BACKLOG.md); this avoids inheriting
            // that same class of risk in new code. Deterministic end to
            // end: fixed sorted adjacency plus a fixed BFS visiting order
            // means the exact same graph always produces the exact same
            // cycle.
            function findCycleThroughNode(sccId, startId) {
                const members = cy.nodes().filter((candidate) => candidate.data('sccId') === sccId);
                const memberIds = new Set(members.map((node) => node.id()));

                const adjacency = new Map();
                members.forEach((node) => adjacency.set(node.id(), []));
                cy.edges().forEach((edge) => {
                    const sourceId = edge.data('source');
                    const targetId = edge.data('target');
                    if (memberIds.has(sourceId) && memberIds.has(targetId)) {
                        adjacency.get(sourceId).push(targetId);
                    }
                });
                adjacency.forEach((targets) => targets.sort());

                const startTargets = adjacency.get(startId) || [];
                if (startTargets.length === 0) {
                    // Shouldn't happen for a real (sccSize >= 2) member -
                    // every member of a non-trivial SCC has at least one
                    // outgoing edge to another member, by definition of
                    // strong connectivity. Defensive only.
                    return null;
                }
                // F7: exclude a self-loop (startId -> startId) from the
                // first-step choice, mirroring the server's own
                // pickFirstStep (buildCycleFindings.ts) - without this, a
                // self-loop that sorts first lets the BFS close on the very
                // first step, producing a degenerate [startId, startId]
                // "cycle" instead of the SCC's real multi-member one. Falls
                // back to the self-loop only if literally nothing else
                // exists, same defensive floor as the server copy.
                const realStartTargets = startTargets.filter((target) => target !== startId);
                const firstStep = realStartTargets[0] ?? startTargets[0];

                const cameFrom = new Map([[firstStep, null]]);
                const queue = [firstStep];
                let head = 0;
                while (head < queue.length) {
                    const current = queue[head];
                    head += 1;
                    if (current === startId) {
                        break;
                    }
                    (adjacency.get(current) || []).forEach((next) => {
                        if (!cameFrom.has(next)) {
                            cameFrom.set(next, current);
                            queue.push(next);
                        }
                    });
                }

                if (!cameFrom.has(startId)) {
                    return null;
                }

                const backToFirstStep = [];
                for (let node = startId; node !== null; node = cameFrom.get(node)) {
                    backToFirstStep.push(node);
                }
                backToFirstStep.reverse();

                return [startId].concat(backToFirstStep);
            }

            // A chip-per-module row reads fine even wrapped across a few
            // lines for a small/medium cycle, but a 100+ member cycle
            // rendered as one row of boxes (wrapped or not) stops being a
            // "sequence you can read" and becomes a wall of boxes - past
            // this many modules, the visual collapses to first/last chips
            // plus an explicit "N more" gap, while the ordered list below
            // (never truncated, only scrollable) stays the actual source
            // of truth for every member.
            const MAX_CYCLE_CHIPS_SHOWN = 20;

            // UI polish only (branch: experiment/cycle-map-v2, no change to
            // findCycleThroughNode/detection semantics below this point) -
            // a fixed row width turns the flat chip-and-arrow row into a
            // small boustrophedon ("snake") flow diagram: row 0 reads
            // left-to-right, row 1 right-to-left, and so on, with a small
            // vertical connector between them - the same reading pattern
            // as the task's own example. Fixed (not measured from the
            // rendered DOM) so it's deterministic and needs no layout
            // pass/resize handling; 4 keeps a 7-member cycle (this
            // codebase's own large-cycle-app fixture) at exactly two rows,
            // matching that example directly.
            const CYCLE_FLOW_ROW_SIZE = 4;

            function renderCycleChip(node, isStart) {
                const classes = ['cycle-chip'];
                // '.not-in-view', not '.area-hidden' - see buildCycleListHtml's
                // own comment below (this diagram and that list describe the
                // exact same member set and must agree on which ones are
                // dimmed/hidden).
                if (node.hasClass('not-in-view')) {
                    classes.push('cycle-chip-hidden');
                }
                if (isStart) {
                    classes.push('cycle-node-start');
                }
                return \`<span class="\${classes.join(' ')}">\${escapeHtml(node.data('label'))}</span>\`;
            }

            // Builds the ordered list of "cells" the flow diagram lays out
            // into rows - each cell is either a real module chip or (once
            // a cycle exceeds MAX_CYCLE_CHIPS_SHOWN) the one "N more"
            // ellipsis placeholder. Cell 0 is always the real selected/
            // start node - the head slice below always includes real
            // index 0 even once collapsed, so the start accent never gets
            // silently dropped for a large cycle.
            function buildCycleFlowCells(memberNodes) {
                const chips = memberNodes.map((node, index) => renderCycleChip(node, index === 0));

                if (memberNodes.length <= MAX_CYCLE_CHIPS_SHOWN) {
                    return chips;
                }

                const headChips = chips.slice(0, 3);
                const tailChips = chips.slice(-2);
                const middleCount = memberNodes.length - headChips.length - tailChips.length;
                const ellipsisHtml = \`<span class="cycle-ellipsis">&hellip; \${middleCount} more &hellip;</span>\`;

                return [...headChips, ellipsisHtml, ...tailChips];
            }

            function buildCycleFlowHtml(memberNodes, startLabel, dict) {
                const cells = buildCycleFlowCells(memberNodes);
                const rows = [];
                for (let i = 0; i < cells.length; i += CYCLE_FLOW_ROW_SIZE) {
                    rows.push(cells.slice(i, i + CYCLE_FLOW_ROW_SIZE));
                }

                const rowsHtml = rows
                    .map((rowCells, rowIndex) => {
                        const isReverse = rowIndex % 2 === 1;
                        const arrow = isReverse
                            ? '<span class="cycle-arrow">&larr;</span>'
                            : '<span class="cycle-arrow">&rarr;</span>';
                        const orderedCells = isReverse ? [...rowCells].reverse() : rowCells;
                        const rowHtml = \`<div class="cycle-flow-row">\${orderedCells.join(arrow)}</div>\`;

                        if (rowIndex === rows.length - 1) {
                            return rowHtml;
                        }

                        // The connector sits under whichever end the row
                        // above actually exits from - the right edge after
                        // a left-to-right row, the left edge after a
                        // right-to-left one - so it visually continues
                        // from the last chip that was just read, not from
                        // wherever it happens to land in the DOM.
                        const connectorSide = isReverse ? 'cycle-flow-connector-left' : 'cycle-flow-connector-right';
                        return \`\${rowHtml}<div class="cycle-flow-connector \${connectorSide}"><span class="cycle-arrow">&darr;</span></div>\`;
                    })
                    .join('');

                // The loop-closing edge is called out as its own short
                // line rather than as one more chip awkwardly appended in
                // whichever direction the last row happens to be reading -
                // simpler to get right for any cycle length/row count, and
                // ties back to the same accent color as the highlighted
                // start chip above so the two read as "the same module".
                return \`
                    <div class="cycle-flow" dir="ltr">\${rowsHtml}</div>
                    <div class="cycle-flow-closing">
                        \${escapeHtml(dict.cycleFlowBackTo)} <span dir="ltr"><span class="cycle-arrow">&#8618;</span> <span class="cycle-chip cycle-node-start">\${startLabel}</span></span>
                    </div>
                \`;
            }

            // Every member is listed, in cycle order, regardless of size -
            // the flow diagram above may collapse a huge cycle to
            // first/last chips, but this list is the "not just a picture"
            // fallback that must stay complete (CSS makes it scrollable
            // instead of ever truncating it). A member not currently on
            // screen ('.not-in-view' - the same combined check used
            // throughout this file for "is this genuinely visible right
            // now", NOT the narrower Area-only '.area-hidden' the "Show in
            // graph" button's own gating uses just below - clicking a row
            // here directly navigates via navigateToSccMember(), it never
            // switches Focus the way that button does, so it needs the
            // same "really on screen" guarantee navigateToSccMember()
            // itself re-checks) is rendered plain and non-navigable,
            // exactly like the SCC member list above, and never gets a
            // data-cycle-nav-id.
            function buildCycleListHtml(memberNodes, dict) {
                return memberNodes
                    .map((node, index) => {
                        const label = escapeHtml(node.data('label'));
                        const filePath = renderPathWithDirHighlight(node.id());
                        const position = \`<span class="cycle-detail-index">\${index + 1}</span>\`;
                        const startCls = index === 0 ? ' cycle-detail-item-start' : '';

                        if (node.hasClass('not-in-view')) {
                            // P1 fix (final pre-release audit): same distinction as
                            // buildCycleContextHtml above - '.not-in-view' alone doesn't
                            // say WHY a member is hidden, only '.area-hidden' does.
                            const hiddenNote = node.hasClass('area-hidden')
                                ? dict.hiddenByFilterNote
                                : dict.hiddenByFocusNote;
                            return \`<li class="cycle-detail-item cycle-detail-item-hidden\${startCls}">\${position}<span class="cycle-detail-item-main"><strong>\${label}</strong><span class="hud-selected-path" dir="ltr">\${filePath}</span></span><span class="hud-scc-member-hidden">\${escapeHtml(hiddenNote)}</span></li>\`;
                        }

                        const navId = escapeAttribute(node.id());
                        return \`<li class="cycle-detail-item\${startCls}" data-cycle-nav-id="\${navId}">\${position}<span class="cycle-detail-item-main"><strong>\${label}</strong><span class="hud-selected-path" dir="ltr">\${filePath}</span></span><span class="cycle-detail-item-arrow">&rsaquo;</span></li>\`;
                    })
                    .join('');
            }

            const cycleDetailModal = document.getElementById('cycle-detail-modal');
            const cycleDetailBody = document.getElementById('cycle-detail-body');
            const cycleDetailCloseButton = document.getElementById('cycle-detail-close-btn');
            const cycleDetailCountBadge = document.getElementById('cycle-detail-count-badge');

            // Tracks whichever node the modal is currently showing a cycle
            // through, so applyLanguage() (see above) can re-render this
            // modal's content in the newly selected language while it's
            // open, and so the close handlers below can clear it again.
            let currentCycleDetailNodeId = null;

            cycleDetailCloseButton?.addEventListener('click', () => cycleDetailModal?.close());
            cycleDetailModal?.addEventListener('close', () => {
                currentCycleDetailNodeId = null;
            });

            // Opening/closing this modal never touches Focus, selection,
            // or the Area/Connections filters on its own - it's a
            // read-only overlay over data that already exists. The one
            // exception is clicking a module inside its own list (wired
            // below), which deliberately reuses navigateToSccMember() -
            // the exact same select+center mechanism as the SCC member
            // list - rather than a second selection system.
            function openCycleDetailModal(nodeId) {
                const node = cy.getElementById(nodeId);
                if (node.empty()) {
                    return;
                }

                const sccId = node.data('sccId');
                if (sccId === undefined) {
                    return;
                }

                const path = findCycleThroughNode(sccId, nodeId);
                if (!path) {
                    return;
                }

                const dict = I18N_DICTIONARIES[currentLanguage];
                currentCycleDetailNodeId = nodeId;

                // path is [startId, ..., startId] (closed loop, startId
                // repeated at both ends) - memberNodes drops that repeat,
                // one entry per distinct module, in cycle order.
                const memberNodes = path.slice(0, -1).map((id) => cy.getElementById(id));
                // '.not-in-view' (genuinely on-screen right now), matching
                // renderCycleChip/buildCycleListHtml above - this note
                // describes the SAME list/diagram they render, not the
                // separate Area-only question the "Show in graph" button
                // below asks.
                //
                // P1 fix (final pre-release audit): '.not-in-view' alone
                // doesn't say WHY - split by '.area-hidden' (Focus-independent)
                // so switching Focus from one SCC to another, then opening this
                // modal for a DIFFERENT cycle, doesn't blame "the current
                // filter" for members that are actually only outside the
                // still-active Focus. See buildCycleListHtml/buildCycleContextHtml
                // above for the same distinction applied to their own per-member
                // notes.
                const areaHiddenCount = memberNodes.filter((member) => member.hasClass('area-hidden')).length;
                const focusHiddenCount = memberNodes.filter(
                    (member) => member.hasClass('not-in-view') && !member.hasClass('area-hidden')
                ).length;
                const startLabel = escapeHtml(memberNodes[0].data('label'));

                // Wording kept exactly as short as the task asked for: the
                // subtitle states the one fact this modal is FOR (a
                // concrete cycle through the selected module), and the
                // "may contain others" caveat - the whole reason this is
                // never phrased as "the cycle" - moves to its own quiet
                // line rather than staying folded into one long sentence.
                if (cycleDetailCountBadge) {
                    cycleDetailCountBadge.textContent = formatI18nClient(
                        memberNodes.length === 1 ? dict.scaleModulesSingular : dict.scaleModules,
                        { n: memberNodes.length }
                    );
                }

                const hiddenNoteHtml =
                    (areaHiddenCount > 0
                        ? \`<p class="cycle-detail-hidden-note">&#8505; \${escapeHtml(
                              formatI18nClient(areaHiddenCount === 1 ? dict.cycleHiddenNoteSingular : dict.cycleHiddenNotePlural, {
                                  n: areaHiddenCount,
                              })
                          )}</p>\`
                        : '') +
                    (focusHiddenCount > 0
                        ? \`<p class="cycle-detail-hidden-note">&#8505; \${escapeHtml(
                              formatI18nClient(focusHiddenCount === 1 ? dict.cycleHiddenNoteSingularFocus : dict.cycleHiddenNotePluralFocus, {
                                  n: focusHiddenCount,
                              })
                          )}</p>\`
                        : '');

                // Findings-first navigation (connecting the overview to
                // the existing graph workflow). "Show in graph" reuses
                // focusScc(sccId) completely unchanged (see the click
                // wiring below) - never a second implementation of
                // "focus this SCC." Gated on the WHOLE SCC's own
                // membership (data.sccSize / a fresh cy.nodes() scan),
                // not just this one representative cycle's own node set
                // - a cycle can visit fewer members than the full SCC in
                // principle, but Focus always operates on the whole SCC
                // regardless of which cycle brought the user here.
                // Omitted entirely (not just disabled) whenever fewer
                // than 2 members are currently visible, matching the
                // exact same rule the HUD's own Focus SCC button already
                // uses - focusScc() would otherwise be a silent no-op.
                //
                // P1-5 fix: '.area-hidden' here is deliberately the
                // Area-only check (Focus-independent - isNodeAreaFiltered()
                // above), matching focusScc()'s own allMembers computation
                // exactly, so this count/button always agrees with what
                // clicking it actually does - including switching Focus
                // straight from some OTHER, currently-focused SCC to this
                // one (this button, and hiddenCount/the list above it, can
                // therefore legitimately disagree while a different Focus
                // is active: hiddenCount describes what's on screen RIGHT
                // NOW, this button describes what focusing HERE would
                // show).
                const sccSize = node.data('sccSize');
                const visibleSccMemberCount = cy
                    .nodes()
                    .filter(
                        (candidate) => candidate.data('sccId') === sccId && !candidate.hasClass('area-hidden')
                    ).length;
                const showInGraphHtml =
                    visibleSccMemberCount >= 2
                        ? \`<button type="button" class="cycle-detail-focus-btn" data-focus-scc-id="\${sccId}" data-focus-start-id="\${escapeAttribute(node.id())}">\${escapeHtml(
                              visibleSccMemberCount < sccSize
                                  ? dict.showInGraphButton + ' ' + formatI18nClient(dict.moduleCountVisibleParen, { visible: visibleSccMemberCount, n: sccSize })
                                  : dict.showInGraphButton
                          )}</button>\`
                        : '';

                if (cycleDetailBody) {
                    // dict.cycleModalSubtitle is not escapeHtml()'d for the
                    // same reason as sccContextPartOf above - it embeds a
                    // real &deg;/&ordm; entity for French/Spanish/
                    // Portuguese, which escaping would corrupt into the
                    // literal text "&amp;deg;".
                    cycleDetailBody.innerHTML = \`
                        <p class="cycle-detail-subtitle">\${formatI18nClient(dict.cycleModalSubtitle, { module: '<strong>' + startLabel + '</strong>', id: sccId + 1 })}</p>
                        <p class="cycle-detail-note">\${escapeHtml(dict.cycleModalNote)}</p>

                        \${showInGraphHtml}

                        <div class="cycle-detail-metadata">
                            <span class="cycle-meta-chip">\${escapeHtml(formatI18nClient(memberNodes.length === 1 ? dict.scaleModulesSingular : dict.scaleModules, { n: memberNodes.length }))}</span>
                            <span class="cycle-meta-chip">\${escapeHtml(formatI18nClient(memberNodes.length === 1 ? dict.scaleDependenciesSingular : dict.scaleDependencies, { n: memberNodes.length }))}</span>
                        </div>

                        \${buildCycleFlowHtml(memberNodes, startLabel, dict)}

                        \${hiddenNoteHtml}

                        <h3>\${escapeHtml(dict.cycleModulesHeading)}</h3>
                        <ol class="cycle-detail-list">\${buildCycleListHtml(memberNodes, dict)}</ol>
                    \`;
                }

                cycleDetailModal?.showModal();
            }

            // Findings-first navigation. Deliberately does NOT recompute a
            // cycle from scratch, and does NOT search for the SCC by
            // module name - the finding row's own data-finding-scc-id
            // (server-provided, see buildCycleFindings.ts/
            // renderSccFindingRow in the Node-side template code) is the
            // only input. The one new piece of logic is picking WHICH
            // member to hand to the existing openCycleDetailModal(nodeId)
            // - the alphabetically smallest member id, the exact same
            // deterministic rule buildCycleFindings.ts already used
            // server-side to pick exampleCycle's own start - so the cycle
            // this opens is provably the same one already previewed in
            // the findings list, not a different arbitrary one. Reuses
            // openCycleDetailModal (and, inside it, findCycleThroughNode)
            // completely unchanged - not a second modal-building
            // implementation. Never filters by '.area-hidden' when
            // picking the start - a concrete cycle is a fact about the
            // whole analyzed graph, matching findCycleThroughNode's own
            // established semantics, not about whatever the current
            // Area/Connections filter happens to be showing.
            function openCycleDetailModalForScc(sccId) {
                const memberIds = cy
                    .nodes()
                    .filter((candidate) => candidate.data('sccId') === sccId)
                    .map((candidate) => candidate.id())
                    .sort();

                if (memberIds.length === 0) {
                    return;
                }

                openCycleDetailModal(memberIds[0]);
            }

            hudSelectedBody?.addEventListener('click', (event) => {
                const cycleButtonEl = event.target.closest('[data-show-cycle-node-id]');

                if (cycleButtonEl) {
                    openCycleDetailModal(cycleButtonEl.dataset.showCycleNodeId);
                }
            });

            // Clicking a module in the cycle's own ordered list, or the
            // "Show in graph" button above it, both close the modal before
            // acting - the main graph pan/select/focus either triggers
            // would otherwise happen invisibly behind the native <dialog>
            // backdrop. "Show in graph" additionally switches to the
            // Graph view (switchToView(), defined near the top of this
            // script) - the user may currently be looking at the Findings
            // view (that's how they could have opened this modal in the
            // first place, via a finding row), and focusScc() itself only
            // ever touches viewport/zoom on the existing graph instance,
            // never which view is showing - without this, "Show in graph"
            // would silently succeed behind the still-visible Findings
            // view.
            cycleDetailBody?.addEventListener('click', (event) => {
                const focusEl = event.target.closest('[data-focus-scc-id]');

                if (focusEl) {
                    cycleDetailModal?.close();
                    focusScc(Number(focusEl.dataset.focusSccId), focusEl.dataset.focusStartId);
                    switchToView('graph');
                    return;
                }

                const itemEl = event.target.closest('[data-cycle-nav-id]');

                if (!itemEl) {
                    return;
                }

                cycleDetailModal?.close();
                navigateToSccMember(itemEl.dataset.cycleNavId);
            });

            cy.on('tap', 'node', (event) => {
                selectNode(event.target);
            });

            cy.on('tap', (event) => {
                if (event.target === cy) {
                    selectedNodeId = null;

                    clearHighlights();

                    updateSelectedModulePanel(null);
                }
            });

            // Everything applyLanguage() might need to re-render on a
            // language switch (cy, selectedNodeId, the HUD/modal wiring)
            // now exists - see graphReady's own declaration further up.
            graphReady = true;
        </script>
    </body>
    </html>
    `;
}
