// Real-DOM/real-cytoscape behavioral test harness for template.ts's client
// script (P1-3/P1-4/P1-5 audit). The audit's own instruction was explicit:
// "don't rely only on string-matching tests of the template source - where
// client-side logic can't be properly checked with plain Jest, use a
// headless browser/real DOM". template.ts's whole interactive script (one
// big top-level <script> block, no IIFE wrapper - every `function
// focusScc(){}`-style declaration in it becomes a real global) is executed
// here via Node's `vm` module inside a real jsdom document built from the
// SAME buildHtmlTemplate() output a real HTML report actually ships, so
// these tests exercise the literal production script, not a reimplementation
// of it.
//
// Two real per-browser gaps jsdom doesn't cover are shimmed, both narrowly:
//   - <dialog>.showModal()/close() (jsdom has no HTMLDialogElement behavior
//     at all as of this jsdom version) - a minimal, standard open-flag +
//     'close' event polyfill, applied once to the prototype.
//   - <canvas>.getContext('2d') (jsdom needs the native `canvas` package,
//     not installed here) - left as null, exactly like a real browser
//     missing that package would leave it; the minimap code already
//     guards every draw behind `if (!minimapCtx) return`, so this is a
//     real, already-handled degradation path, not a crash risk.
//
// cytoscape itself runs for real (the exact npm dependency this project
// ships), but forced into headless mode - `cy.container()` still needs a
// live element (the script itself calls
// `cy.container().addEventListener('wheel', ...)` unconditionally right
// after construction, and headless mode's own `cy.container()` returns
// null), so the one bridging shim here is handing back a real (offscreen,
// unrendered) jsdom <div> for `cy.container()` calls. Every other cytoscape
// API - event emission/handling, classes, data, layouts (including the
// real dagre layout, loaded from the same static/assets bundle the shipped
// report embeds) - runs completely unmodified.
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildHtmlTemplate } from '../template';
import type { CytoscapeEdge, CytoscapeNode } from '../../adapters';
import type { CycleFindings } from '../../findings/buildCycleFindings';

const ASSETS_ROOT = path.join(__dirname, '../../../../../static/assets');

// Loaded once per test process - cytoscape-dagre's UMD wrapper does
// `require('dagre')` as if it were an installed npm package (it isn't;
// dagre.min.js is a separate <script>-tag bundle in the real report,
// providing a global). scripts/repro-dagre-layout-scale.mjs solves this
// standalone-under-plain-Node the same way this used to (monkey-patching
// node:module's own resolver), but that doesn't reach requires made from
// inside Jest's own sandboxed module registry - jest.doMock's `virtual`
// option is the Jest-native equivalent of exactly this "shim a module
// specifier that doesn't really exist as an installed package" need.
function loadRealCytoscapeWithDagre() {
    const dagre = require(path.join(ASSETS_ROOT, 'dagre.min.js'));
    jest.doMock('dagre', () => dagre, { virtual: true });

    const cytoscape = require(path.join(ASSETS_ROOT, 'cytoscape.min.js'));
    const cytoscapeDagre = require(path.join(ASSETS_ROOT, 'cytoscape-dagre.js'));
    cytoscape.use(cytoscapeDagre);

    return { cytoscape, cytoscapeDagre };
}

const { cytoscape: realCytoscape, cytoscapeDagre: realCytoscapeDagre } = loadRealCytoscapeWithDagre();

// A minimal structural slice of cytoscape's real Core/Collection API -
// just the members these behavioral tests actually call. No
// `@types/cytoscape` package is installed in this project (the real
// dependency is consumed by the generated report as a plain UMD global,
// never imported as a typed module by any existing source file), so this
// is deliberately narrow rather than an attempt at a full type surface.
export interface CyElement {
    id(): string;
    hasClass(className: string): boolean;
    empty(): boolean;
    data(key?: string): unknown;
}

export interface CyCollection extends CyElement {
    length: number;
    filter(predicate: (ele: CyElement, index: number) => boolean): CyCollection;
}

export interface CyCore {
    getElementById(id: string): CyElement;
    nodes(): CyCollection;
    edges(): CyCollection;
}

export type RenderedReport = {
    dom: JSDOM;
    document: Document;
    // The one real cytoscape.Core instance the script's own
    // `const cy = cytoscape({...})` created - captured harness-side (see
    // installHeadlessCytoscape below) purely for these tests' own
    // introspection. `cy` itself is a script-local `const`, never a
    // `window` property in a real browser either - production code is
    // never changed to expose it.
    cy: CyCore;
    // Every top-level `function` declaration in template.ts's inline
    // script becomes a global in the executed vm context (classic-script
    // semantics - unlike top-level `let`/`const`, which stay scoped to
    // that one script evaluation and are only reachable via closures
    // INSIDE these same functions, exactly like a real browser). This is
    // every entry point these behavioral tests drive.
    win: Window &
        typeof globalThis & {
            focusScc: (sccId: number, startId?: string | null) => void;
            exitFocus: () => void;
            selectNode: (node: unknown) => void;
            navigateToSccMember: (nodeId: string) => void;
            openCycleDetailModal: (nodeId: string) => void;
            openCycleDetailModalForScc: (sccId: number) => void;
            switchToView: (view: 'findings' | 'graph') => void;
            applyLanguage: (lang: string) => void;
            // F25b
            openExploreSccModal: (sccId: number) => void;
            // F6
            runLayoutForCurrentView: (layoutName: string) => void;
        };
};

function polyfillDialog(win: Window & typeof globalThis): void {
    const proto = win.HTMLDialogElement.prototype as HTMLDialogElement & {
        showModal?: () => void;
        show?: () => void;
        close?: () => void;
    };

    if (typeof proto.showModal === 'function') {
        return;
    }

    Object.defineProperty(proto, 'open', {
        get(this: HTMLElement) {
            return this.hasAttribute('open');
        },
        set(this: HTMLElement, value: boolean) {
            if (value) {
                this.setAttribute('open', '');
            } else {
                this.removeAttribute('open');
            }
        },
        configurable: true,
    });

    proto.showModal = function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    };
    proto.show = function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    };
    proto.close = function (this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new win.Event('close'));
    };
}

// Forces headless:true on every cytoscape() call regardless of the options
// literally written in template.ts's own script (which passes a real
// `container`/`layout` - unmodified production code, never touched for
// testability) - headless mode skips the canvas-based renderer entirely
// (jsdom has no canvas 2D context without the native `canvas` package),
// while every graph-model API (classes, data, events, layouts) still runs
// for real. `cy.container()` is patched back to a real (offscreen) jsdom
// element, since headless mode's own `cy.container()` returns null and the
// script unconditionally calls `.addEventListener('wheel', ...)` on it
// immediately after construction.
//
// Also captures the real, single cytoscape.Core instance the script's own
// `const cy = cytoscape({...})` creates, purely for these tests' own
// introspection - `cy` itself stays a script-local `const` exactly as
// production code wrote it (never exposed on `window` by template.ts
// itself); this holder is filled as a SIDE EFFECT of the wrapped
// constructor call, entirely on the test-harness side of the boundary.
function installHeadlessCytoscape(win: Window & typeof globalThis): { instance: CyCore | null } {
    const fakeContainer = win.document.createElement('div');
    const holder: { instance: CyCore | null } = { instance: null };
    const winWithCytoscape = win as unknown as {
        cytoscape: { (opts: Record<string, unknown>): CyCore; use: (extension: unknown) => void };
        cytoscapeDagre: unknown;
    };

    const cytoscapeFactory = (opts: Record<string, unknown>) => {
        // opts (elements/style/layout) is built by code running INSIDE the
        // vm context, so every plain object/array in it is an object of
        // that vm context's OWN Array/Object - not this (outer, real
        // Node) realm's. Passing those straight into the real cytoscape
        // module (loaded in the outer realm) silently breaks its internal
        // Array.isArray/plain-object checks across the realm boundary -
        // confirmed directly: cytoscape happily constructs but cy.nodes()
        // comes back empty, elements included. `container` is dropped
        // first (a live DOM element can't round-trip through JSON at
        // all - it's overridden below anyway), then the rest is
        // normalized into this realm's own native types via a JSON
        // round-trip - safe here because elements/style/layout are all
        // plain JSON-shaped data (verified: no functions/Infinity/NaN
        // anywhere in what template.ts actually passes to cytoscape()).
        const { container: _container, ...rest } = opts;
        const normalizedOpts = JSON.parse(JSON.stringify(rest));
        const instance = realCytoscape({ ...normalizedOpts, headless: true, container: undefined });
        instance.container = () => fakeContainer;
        holder.instance = instance as CyCore;
        return instance;
    };
    // The script itself calls `cytoscape.use(cytoscapeDagre)` (mirroring
    // the real report's three vendored <script src> tags registering
    // globals for each other) - dagre is already registered on the real
    // cytoscape module once, in loadRealCytoscapeWithDagre() above, so
    // this only needs to exist and not throw, never re-register anything.
    cytoscapeFactory.use = () => {};
    winWithCytoscape.cytoscape = cytoscapeFactory;
    winWithCytoscape.cytoscapeDagre = realCytoscapeDagre;

    return holder;
}

export type RenderReportArgs = {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
    findings: CycleFindings;
};

export type RenderReportOptions = {
    // F6: the initial Full Graph layout is no longer run synchronously as
    // part of the script (see scheduleLayout() in template.ts) - it's
    // deferred by one macrotask so the browser gets a chance to paint
    // first. Every caller of this harness already runs under
    // jest.useFakeTimers() (see this file's own callers' beforeEach), so
    // by default (true) this flushes that one pending tick before
    // returning, keeping every EXISTING test's assertions (which expect
    // the initial layout already applied) unchanged. Pass false only for
    // a test that specifically wants to observe the still-deferred state,
    // or to drive supersession itself before that first tick ever fires.
    flushInitialLayout?: boolean;
};

// Renders the exact production buildHtmlTemplate() output, then executes
// its own single inline <script> (extracted verbatim - never rewritten or
// reimplemented) inside a real jsdom document via vm.runInContext(), the
// documented mechanism for running a script as if it were a <script> tag
// in a given jsdom window (see jsdom's own getInternalVMContext() docs).
// The report's three `<script src="./assets/...">` tags are left in the
// markup (jsdom never fetches external resources by default, so they're
// inert) - only cytoscape is provided, and only as the real headless
// wrapper above.
// Every jsdom window created by renderInteractiveReport() is tracked here
// so a test file can reliably close them all in one afterEach - Focus's
// own 'cose' layout (runFocusLayout()) is a real, ANIMATED/iterative
// cytoscape layout (unlike the initial one-shot dagre layout), so it keeps
// scheduling itself via the window's own setTimeout-based ~60fps tick loop
// until it visually converges. That's real, correct cytoscape behavior
// (irrelevant to what these tests assert - the '.not-in-view'/selection/
// HUD state focusScc() itself sets is already final by the time it
// returns, well before the layout's own animation ever starts), but left
// running it would leak timers past the end of every test that calls
// focusScc(). window.close() is jsdom's own documented way to tear down a
// window, including cancelling its pending timers.
const openWindows = new Set<Window>();

export function closeAllRenderedReports(): void {
    for (const win of openWindows) {
        win.close();
    }
    openWindows.clear();
}

// jsdom logs a "Not implemented: HTMLCanvasElement.prototype.getContext"
// console.error every time the minimap's own `canvas.getContext('2d')`
// call returns null (see the file-level comment above) - real, expected,
// already-handled-by-production-code noise, not a test failure signal, so
// it's suppressed here rather than left to clutter every test run's
// output. Every other jsdom console channel (real page console.log/warn,
// unhandled script errors) is left completely alone.
const silentVirtualConsole = new VirtualConsole();
silentVirtualConsole.on('jsdomError', () => {});

export function renderInteractiveReport(
    args: RenderReportArgs,
    options: RenderReportOptions = {},
): RenderedReport {
    const { flushInitialLayout = true } = options;
    const html = buildHtmlTemplate(args);

    const dom = new JSDOM(html, {
        url: 'http://localhost/report.html',
        pretendToBeVisual: true,
        runScripts: 'outside-only',
        virtualConsole: silentVirtualConsole,
    });
    const win = dom.window as unknown as RenderedReport['win'];
    openWindows.add(dom.window as unknown as Window);

    polyfillDialog(win);
    const cyHolder = installHeadlessCytoscape(win);

    const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    const inlineScript = scriptMatches.at(-1)?.[1];

    if (!inlineScript) {
        throw new Error('renderInteractiveReport: could not find the inline <script> body');
    }

    vm.runInContext(inlineScript, dom.getInternalVMContext());

    if (!cyHolder.instance) {
        throw new Error('renderInteractiveReport: cytoscape() was never called by the executed script');
    }

    if (flushInitialLayout) {
        jest.advanceTimersByTime(0);
    }

    return { dom, document: win.document, win, cy: cyHolder.instance };
}
