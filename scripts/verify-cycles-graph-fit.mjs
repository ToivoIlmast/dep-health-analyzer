// Real-Chromium behavioral verification for the cycles Graph view's
// chrome-avoiding fit math (measureChromeInsets/fitCyAvoidingChrome in
// src/features/cycles/visualization/template.ts) and the concrete-cycle
// modal's Area-filter-vs-Focus hidden-member wording (openCycleDetailModal/
// buildCycleContextHtml/buildCycleListHtml, same file).
//
// Why this exists as a standalone script, not a Jest test: Jest runs in
// jsdom, which has no real layout engine - getBoundingClientRect(),
// getComputedStyle() sizing, and cytoscape's own canvas rendering are all
// unavailable there (see the many "Jest can't execute this against a live
// cytoscape instance, asserts source structure instead" comments already
// throughout template.test.ts). The two bugs this script targets are pure
// viewport/DOM-geometry math - a source-string assertion can (and did, see
// git history) keep passing on a real geometry regression, because it only
// checks that a particular line of code exists, never what it actually
// computes once real element sizes are involved. This drives the actual
// generated report HTML in a real headless Chromium, the same way a
// reader would, and asserts on real measured rects and cytoscape state.
// Same pattern already established by scripts/repro-dagre-layout-scale.mjs
// and scripts/benchmark-graph-overlap.mjs for the same underlying reason
// (something only observable against a real rendered/laid-out graph).
//
// Prerequisites (not installed by this script or wired into `npm install`,
// same reasoning as above - this is a manually-run diagnostic, not part of
// the automated `npm run tff` pipeline, since a real browser isn't
// guaranteed available in every environment this repo is worked in):
//   1. npm install --no-save playwright-core
//   2. A Chromium build reachable at one of the paths CHROMIUM_CANDIDATES
//      resolves below, or set PLAYWRIGHT_CHROMIUM_PATH to point at one
//      directly (e.g. `npx playwright install chromium` downloads one
//      under ~/.cache/ms-playwright/ on most systems). On a minimal Linux
//      box without libnspr4/libnss3/libasound2 already installed and no
//      root access for `apt install`, they can still be obtained without
//      root via `apt-get download libnspr4 libnss3 libasound2t64`, then
//      `dpkg-deb -x <file>.deb <some-dir>` each into a local directory,
//      and running this script with
//      LD_LIBRARY_PATH=<that-dir>/usr/lib/x86_64-linux-gnu.
//   3. npm run build (the report embeds template.ts's compiled output)
//   4. npm run test-projects-scale:generate (creates
//      test-projects-scale/cycles-large - only needs to be done once,
//      the corpus is gitignored/regenerated locally, see
//      test-projects-scale/README.md)
//
// Usage: node scripts/verify-cycles-graph-fit.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLI = path.join(ROOT, 'dist/app/cli.js');
const CYCLES_LARGE_DIR = path.join(ROOT, 'test-projects-scale/cycles-large');

let chromium;
try {
    ({ chromium } = await import('playwright-core'));
} catch {
    console.error('playwright-core is not installed. Run: npm install --no-save playwright-core');
    process.exit(1);
}

if (!fs.existsSync(CLI)) {
    console.error(`${CLI} not found. Run: npm run build`);
    process.exit(1);
}

if (!fs.existsSync(CYCLES_LARGE_DIR)) {
    console.error(`${CYCLES_LARGE_DIR} not found. Run: npm run test-projects-scale:generate`);
    process.exit(1);
}

function resolveChromiumExecutable() {
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
        return process.env.PLAYWRIGHT_CHROMIUM_PATH;
    }
    const cacheRoot = path.join(os.homedir(), '.cache/ms-playwright');
    if (!fs.existsSync(cacheRoot)) {
        return null;
    }
    const candidates = fs
        .readdirSync(cacheRoot)
        .filter((name) => name.startsWith('chromium-') && !name.includes('headless_shell'))
        .sort()
        .reverse();
    for (const name of candidates) {
        for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
            const full = path.join(cacheRoot, name, rel);
            if (fs.existsSync(full)) {
                return full;
            }
        }
    }
    return null;
}

// A small fixture with many DISTINCT top-level src/ subdirectories, one
// tiny two-file cycle each - reproduces the actual trigger for the P0 bug
// (computeModuleArea() in buildCytoscapeElements.ts derives one legend
// row per distinct immediate child of src/, so this yields a genuinely
// tall #hint the same way a real project with a dozen-plus top-level
// feature areas would, unlike cycles-large's own fixture which - despite
// being ~600 modules - only has 3 such areas and never reproduces this
// specific failure mode on its own).
const AREA_NAMES = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november'];

function buildManyAreasFixture(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const area of AREA_NAMES) {
        fs.mkdirSync(path.join(dir, 'src', area), { recursive: true });
        fs.writeFileSync(path.join(dir, 'src', area, 'x.ts'), "import { y } from './y';\nexport function x() { return 'x' + y(); }\n");
        fs.writeFileSync(path.join(dir, 'src', area, 'y.ts'), "import { x } from './x';\nexport function y() { return 'y' + x(); }\n");
    }
    fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'many-areas-fixture', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } }, null, 2)
    );
    fs.writeFileSync(path.join(dir, 'dep-health.config.json'), JSON.stringify({ features: { scc: { enabled: true } } }, null, 2));
}

function generateReport(projectDir) {
    // A stale reports/ dir from a previous (e.g. interrupted) run would
    // get rescanned as extra "source" modules on the next pass (its own
    // copied assets/*.js) - always start from a clean slate.
    const reportsDir = path.join(projectDir, 'reports');
    fs.rmSync(reportsDir, { recursive: true, force: true });

    // A non-zero exit (process.exit(1) in src/app/cli.ts) is expected
    // here - both fixtures deliberately contain cycles, which trips the
    // scc feature's own failOn threshold. The HTML report is written
    // regardless, so only genuinely missing output is a real error.
    try {
        execFileSync(process.execPath, [CLI, 'cycles', '--mode', 'html'], { cwd: projectDir, stdio: 'pipe' });
    } catch (err) {
        if (!fs.existsSync(path.join(reportsDir, 'cycles.html'))) {
            throw err;
        }
    }
    return path.join(reportsDir, 'cycles.html');
}

const results = [];
function record(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? '  (' + detail + ')' : ''));
}

// Captures the live cytoscape() instance the report's own inline script
// creates, without modifying template.ts - cytoscape.min.js assigns
// `window.cytoscape = factory()` (UMD browser global); redefining the
// property lets us wrap whatever gets assigned and stash every instance
// it ever constructs. A Proxy, not a plain wrapping function, so static
// properties the real module carries (.use(), which registers the dagre
// extension) still resolve through - only the CALL itself is intercepted.
const CAPTURE_CY_INIT_SCRIPT = `
(function () {
    let real;
    let wrapper;
    Object.defineProperty(window, 'cytoscape', {
        configurable: true,
        get() { return wrapper; },
        set(fn) {
            real = fn;
            wrapper = new Proxy(function (...args) {
                const instance = real.apply(this, args);
                window.__testCy = instance;
                return instance;
            }, {
                get(target, prop, receiver) {
                    if (prop in target) return Reflect.get(target, prop, receiver);
                    return real[prop];
                },
            });
        },
    });
})();
`;

async function openReport(browser, reportPath, viewport) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(CAPTURE_CY_INIT_SCRIPT);
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('  [pageerror]', err.message));
    await page.goto('file://' + reportPath);
    await page.waitForFunction(() => !!window.__testCy && window.__testCy.nodes().length > 0);
    return { context, page };
}

async function switchToGraph(page) {
    await page.click('[data-view="graph"]');
    await page.waitForTimeout(100);
}

async function switchToFindings(page) {
    await page.click('[data-view="findings"]');
    await page.waitForTimeout(100);
}

// The focus layout ('cose', a physics simulation - unlike dagre it has no
// fixed iteration count) fires layoutstop (and its own
// fitCyAvoidingChrome() call) well after a click returns. Polling for "N
// equal reads in a row" alone is a race: the first few reads are trivially
// "stable" at the OLD, pre-focus zoom before the layout has even started
// moving it - this must first observe zoom actually differ from that
// baseline before it starts looking for stability.
async function waitForZoomStable(page, { pollMs = 60, stableReads = 3, timeoutMs = 5000, baseline } = {}) {
    if (baseline === undefined) {
        baseline = await page.evaluate(() => window.__testCy.zoom());
    }
    const start = Date.now();
    let last = null;
    let stableCount = 0;
    let changedFromBaseline = false;
    while (Date.now() - start < timeoutMs) {
        const current = await page.evaluate(() => window.__testCy.zoom());
        if (!changedFromBaseline) {
            if (Math.abs(current - baseline) > 1e-9) {
                changedFromBaseline = true;
                last = current;
                stableCount = 0;
            }
            await page.waitForTimeout(pollMs);
            continue;
        }
        if (last !== null && Math.abs(current - last) < 1e-9) {
            stableCount += 1;
            if (stableCount >= stableReads) {
                return current;
            }
        } else {
            stableCount = 0;
        }
        last = current;
        await page.waitForTimeout(pollMs);
    }
    return last ?? baseline;
}

async function measureFitState(page) {
    return page.evaluate(() => {
        const cy = window.__testCy;
        const cyContainerRect = cy.container().getBoundingClientRect();
        const hintEl = document.getElementById('hint');
        const toolbarEl = document.getElementById('toolbar');
        const hintRect = hintEl ? hintEl.getBoundingClientRect() : null;
        const toolbarRect = toolbarEl ? toolbarEl.getBoundingClientRect() : null;

        const visible = cy.nodes().filter((n) => !n.hasClass('not-in-view'));
        const rbb = visible.length > 0 ? visible.renderedBoundingBox() : null;

        const graphPageRect = rbb
            ? {
                  left: cyContainerRect.left + rbb.x1,
                  right: cyContainerRect.left + rbb.x2,
                  top: cyContainerRect.top + rbb.y1,
                  bottom: cyContainerRect.top + rbb.y2,
                  width: rbb.w,
                  height: rbb.h,
              }
            : null;

        return {
            zoom: cy.zoom(),
            visibleNodeCount: visible.length,
            cyContainerRect: {
                left: cyContainerRect.left,
                right: cyContainerRect.right,
                top: cyContainerRect.top,
                bottom: cyContainerRect.bottom,
                width: cyContainerRect.width,
                height: cyContainerRect.height,
            },
            hintRect: hintRect && { left: hintRect.left, right: hintRect.right, top: hintRect.top, bottom: hintRect.bottom },
            toolbarRect: toolbarRect && { left: toolbarRect.left, right: toolbarRect.right, top: toolbarRect.top, bottom: toolbarRect.bottom },
            graphPageRect,
            currentFocusActive: !document.getElementById('show-full-graph-btn')?.hidden,
        };
    });
}

function rectsOverlap(a, b, tolerance = 1) {
    if (!a || !b) return false;
    return a.left < b.right - tolerance && a.right > b.left + tolerance && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
}

// Independently recomputes the zoom fitCyAvoidingChrome() SHOULD have
// produced from real, freshly-measured DOM rects (mirroring its formula,
// not importing it), and compares against the actual zoom cytoscape ended
// up at. Deliberately not an absolute zoom threshold: cycles-large's own
// real ~600-module graph legitimately fits at a very small zoom (it's
// just a huge graph), so "zoom is small" alone proves nothing - what
// matters is that the chrome-aware formula, not some collapsed/fallback
// path, produced the actual number.
async function assertCorrectZoomMath(page, label, basePadding) {
    const state = await measureFitState(page);
    const { zoom, graphPageRect, hintRect, toolbarRect, cyContainerRect } = state;

    if (!graphPageRect) {
        record(label + ': zoom math (no visible graph to check)', false, 'no rendered bounding box');
        return state;
    }

    const leftInset = Math.max(basePadding, (hintRect ? hintRect.right - cyContainerRect.left : 0) + 16);
    const rightInset = Math.max(basePadding, 16);
    const topInset = Math.max(basePadding, (toolbarRect ? toolbarRect.bottom - cyContainerRect.top : 0) + 16);
    const bottomInset = Math.max(basePadding, 16);
    const availableWidth = Math.max(1, cyContainerRect.width - leftInset - rightInset);
    const availableHeight = Math.max(1, cyContainerRect.height - topInset - bottomInset);

    const naturalWidth = graphPageRect.width / zoom;
    const naturalHeight = graphPageRect.height / zoom;
    const expectedZoom = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);

    const ratio = zoom / expectedZoom;
    const withinTolerance = ratio > 0.9 && ratio < 1.1;
    record(
        label + ': actual zoom matches the chrome-aware formula (not collapsed/fallback)',
        withinTolerance,
        `actual=${zoom.toFixed(4)} expected=${expectedZoom.toFixed(4)} ratio=${ratio.toFixed(3)} availableWidth=${availableWidth.toFixed(0)} availableHeight=${availableHeight.toFixed(0)}`
    );
    return state;
}

async function assertGoodFit(page, label, { basePadding = 80 } = {}) {
    const state = await assertCorrectZoomMath(page, label, basePadding);
    const { graphPageRect, hintRect, toolbarRect, cyContainerRect, visibleNodeCount } = state;

    if (graphPageRect) {
        const withinContainerX = graphPageRect.left >= cyContainerRect.left - 5 && graphPageRect.right <= cyContainerRect.right + 5;
        const withinContainerY = graphPageRect.top >= cyContainerRect.top - 5 && graphPageRect.bottom <= cyContainerRect.bottom + 5;
        record(label + ': graph horizontally within container', withinContainerX, `graph=[${graphPageRect.left.toFixed(0)},${graphPageRect.right.toFixed(0)}] container=[${cyContainerRect.left.toFixed(0)},${cyContainerRect.right.toFixed(0)}]`);
        record(label + ': graph vertically within container', withinContainerY, `graph=[${graphPageRect.top.toFixed(0)},${graphPageRect.bottom.toFixed(0)}] container=[${cyContainerRect.top.toFixed(0)},${cyContainerRect.bottom.toFixed(0)}]`);

        const overlapsHint = rectsOverlap(graphPageRect, hintRect);
        const overlapsToolbar = rectsOverlap(graphPageRect, toolbarRect);
        record(label + ': graph does not overlap #hint', !overlapsHint, overlapsHint ? `graph=${JSON.stringify(graphPageRect)} hint=${JSON.stringify(hintRect)}` : '');
        record(label + ': graph does not overlap #toolbar', !overlapsToolbar, overlapsToolbar ? `graph=${JSON.stringify(graphPageRect)} toolbar=${JSON.stringify(toolbarRect)}` : '');
    } else {
        record(label + ': graph has a rendered bounding box', false, `visibleNodeCount=${visibleNodeCount}`);
    }

    return state;
}

async function main() {
    const executablePath = resolveChromiumExecutable();
    if (!executablePath) {
        console.error('No cached Chromium found. Run `npx playwright install chromium`, or set PLAYWRIGHT_CHROMIUM_PATH.');
        process.exit(1);
    }

    const manyAreasDir = path.join(os.tmpdir(), 'dep-health-verify-many-areas-fixture');
    buildManyAreasFixture(manyAreasDir);
    const manyAreasReport = generateReport(manyAreasDir);
    const cyclesLargeReport = generateReport(CYCLES_LARGE_DIR);

    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

    // --- P0: tall #hint legend (14 areas) must not collapse the fit ---
    {
        const { context, page } = await openReport(browser, manyAreasReport, { width: 1366, height: 768 });
        const areaCount = await page.evaluate(() => document.querySelectorAll('#area-legend > div').length);
        record('many-areas fixture actually renders >= 12 legend rows', areaCount >= 12, 'areaCount=' + areaCount);
        const hintHeight = await page.evaluate(() => document.getElementById('hint').getBoundingClientRect().height);
        record('many-areas fixture #hint is genuinely tall (legend effect reproduced)', hintHeight > 400, 'hintHeight=' + hintHeight.toFixed(0));

        await switchToGraph(page);
        await assertGoodFit(page, 'many-areas @ 1366x768 Full Graph');
        await context.close();
    }
    {
        const { context, page } = await openReport(browser, manyAreasReport, { width: 1920, height: 1080 });
        await switchToGraph(page);
        await assertGoodFit(page, 'many-areas @ 1920x1080 Full Graph');
        await context.close();
    }

    // --- P0: cycles-large (real-world scale) at both window sizes, incl. Fit Graph button ---
    for (const viewport of [
        { width: 1366, height: 768 },
        { width: 1920, height: 1080 },
    ]) {
        const { context, page } = await openReport(browser, cyclesLargeReport, viewport);
        await switchToGraph(page);
        await assertGoodFit(page, `cycles-large @ ${viewport.width}x${viewport.height} Full Graph`);

        await page.click('#fit-btn');
        await page.waitForTimeout(100);
        await assertGoodFit(page, `cycles-large @ ${viewport.width}x${viewport.height} after clicking Fit Graph`, { basePadding: 40 });
        await context.close();
    }

    // --- P0: "hub" Focused Graph (cycles-large's largest SCC) ---
    {
        const { context, page } = await openReport(browser, cyclesLargeReport, { width: 1366, height: 768 });

        const sccId = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('.finding-row'));
            let best = null;
            let bestSize = -1;
            for (const row of rows) {
                const header = row.querySelector('.finding-row-header')?.textContent || '';
                const match = header.match(/(\d+)\s+modules/);
                const size = match ? Number(match[1]) : 0;
                if (size > bestSize) {
                    bestSize = size;
                    best = row.dataset.findingSccId;
                }
            }
            return best;
        });
        record('found the largest-SCC finding row (hub candidate)', sccId !== null, 'sccId=' + sccId);

        await page.click(`.finding-row[data-finding-scc-id="${sccId}"] .finding-view-cycle-btn`);
        await page.waitForSelector('#cycle-detail-modal[open]');
        const preFocusZoom = await page.evaluate(() => window.__testCy.zoom());
        await page.click('#cycle-detail-modal .cycle-detail-focus-btn');
        await waitForZoomStable(page, { baseline: preFocusZoom });

        const focusState = await assertGoodFit(page, 'cycles-large hub Focused Graph');
        record('hub Focused Graph: Focus is actually active (Show full graph button visible)', focusState.currentFocusActive === true);
        record('entering Focus did not itself exit Focus (its own internal fit is not the toolbar Fit Graph button)', focusState.currentFocusActive === true);

        await context.close();
    }

    // --- P1: Focus SCC A, then open a cycle-detail modal for a DIFFERENT SCC B - hidden note must not blame "the current filter" ---
    {
        const { context, page } = await openReport(browser, cyclesLargeReport, { width: 1366, height: 768 });

        const sccIds = await page.evaluate(() => Array.from(document.querySelectorAll('.finding-row')).map((r) => r.dataset.findingSccId));
        record('cycles-large has at least 2 SCC findings for the A/B focus-switch check', sccIds.length >= 2, 'count=' + sccIds.length);
        const [sccA, sccB] = sccIds;

        await page.click(`.finding-row[data-finding-scc-id="${sccA}"] .finding-view-cycle-btn`);
        await page.waitForSelector('#cycle-detail-modal[open]');
        const preFocusZoomA = await page.evaluate(() => window.__testCy.zoom());
        await page.click('#cycle-detail-modal .cycle-detail-focus-btn');
        await waitForZoomStable(page, { baseline: preFocusZoomA });

        const focusedOnA = await page.evaluate(() => !document.getElementById('show-full-graph-btn')?.hidden);
        record("Focus SCC A is active before opening SCC B's modal", focusedOnA === true);

        await switchToFindings(page);
        await page.click(`.finding-row[data-finding-scc-id="${sccB}"] .finding-view-cycle-btn`);
        await page.waitForSelector('#cycle-detail-modal[open]');

        const modalState = await page.evaluate(() => {
            const body = document.getElementById('cycle-detail-body');
            return {
                html: body ? body.innerHTML : null,
                stillFocusedOnA: !document.getElementById('show-full-graph-btn')?.hidden,
            };
        });

        record("Focus SCC A is still active while SCC B's modal is open (opening the modal does not exit Focus)", modalState.stillFocusedOnA === true);

        const mentionsFilter = /hidden by the current filter/i.test(modalState.html || '');
        const mentionsFocus = /hidden by the current Focus/i.test(modalState.html || '') || /hud-scc-member-hidden">[^<]*Focus/i.test(modalState.html || '');

        record('P1 fix: modal does NOT say "hidden by the current filter" when the real cause is Focus', !mentionsFilter, mentionsFilter ? 'FOUND stale filter wording in modal HTML' : 'not present, as expected');
        record('P1 fix: modal note (if any) correctly attributes hiding to Focus, not filter', mentionsFocus, mentionsFocus ? 'Focus wording found' : 'no Focus wording found');

        await context.close();
    }

    await browser.close();
    fs.rmSync(manyAreasDir, { recursive: true, force: true });
    fs.rmSync(path.join(CYCLES_LARGE_DIR, 'reports'), { recursive: true, force: true });

    const failed = results.filter((r) => !r.pass);
    console.log('\n' + '='.repeat(60));
    console.log(`${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length > 0) {
        console.log('\nFAILED:');
        failed.forEach((f) => console.log('  - ' + f.name + (f.detail ? '  (' + f.detail + ')' : '')));
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
