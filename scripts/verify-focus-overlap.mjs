// Real-Chromium behavioral verification for F9 (AUDIT_v0.11.0.md): the
// Focused Graph's overlap resolver (resolveNodeOverlaps in
// src/features/cycles/visualization/template.ts) reads node size via
// node.width()/node.height() - the node style is 'width': 'label',
// 'height': 'label', 'padding': '10px', and width()/height() return the
// label box WITHOUT that padding (or any border). The pure overlap-
// resolution algorithm (graphOverlapResolution.ts, unit-tested directly)
// is correct on whatever {width, height} it is given - the bug is only in
// this cytoscape-facing adapter feeding it an undersized box, so the
// resolver can report "no overlap left" while the real, rendered boxes
// still overlap.
//
// Why this exists as a standalone script, not a Jest test: Jest runs in
// jsdom via vm.runInContext (see browserHarness.ts), and the real
// cytoscape.js constructor there is forced into headless:true - which
// (see cytoscape.min.js's own Core constructor) defaults styleEnabled to
// false whenever headless and no live-rendered container are both true.
// With styleEnabled false, ALL style-driven sizing (node.width(),
// node.outerWidth(), including 'width':'label' itself) is pinned at a
// trivial fallback (measured directly: 1x1) for every node, regardless of
// style or any bypass override - confirmed directly while investigating
// this finding. There is no discrepancy between width() and outerWidth()
// to observe in that harness at all, so a Jest-level test can only check
// which accessor the source code CALLS (see the companion assertion in
// template.test.ts, 'F9 fix: ... outerWidth/outerHeight'), never that the
// real rendered geometry is actually free of overlap. This script is the
// one place that can: it drives the actual generated report HTML in a
// real, non-headless-styled Chromium (same technique already established
// by verify-cycles-graph-fit.mjs for the equivalent F5/F8 geometry
// findings) and measures real renderedBoundingBox() rects.
//
// Prerequisites (same as verify-cycles-graph-fit.mjs - see that script's
// own header for the full manual-install rationale):
//   1. npm install --no-save playwright-core
//   2. A cached Chromium (npx playwright install chromium) or
//      PLAYWRIGHT_CHROMIUM_PATH pointing at one
//   3. npm run build
//   4. npm run test-projects-scale:generate (creates
//      test-projects-scale/cycles-large - its largest SCC, 50 modules, is
//      exactly the "cycle core drawn on top of itself" shape F9 reports)
//
// Usage: node scripts/verify-focus-overlap.mjs
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

// Current report output convention (dep-health-reports/scc.html, relative
// to the scanned project's own cwd) - confirmed directly against the CLI,
// not assumed. verify-cycles-graph-fit.mjs's own generateReport() still
// expects an older reports/cycles.html path and currently fails outright
// against a fresh checkout for that reason alone - a separate, pre-
// existing staleness bug in that script, unrelated to F9, left unfixed
// here (out of this finding's scope).
function generateReport(projectDir) {
    const reportsDir = path.join(projectDir, 'dep-health-reports');
    fs.rmSync(reportsDir, { recursive: true, force: true });

    // A non-zero exit is expected here (cycles-large deliberately contains
    // cycles, which trips the scc feature's own failOn threshold) - the
    // HTML report is written regardless, so only genuinely missing output
    // is a real error.
    try {
        execFileSync(process.execPath, [CLI, 'cycles', '--mode', 'html'], { cwd: projectDir, stdio: 'pipe' });
    } catch (err) {
        if (!fs.existsSync(path.join(reportsDir, 'scc.html'))) {
            throw err;
        }
    }
    return path.join(reportsDir, 'scc.html');
}

const results = [];
function record(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? '  (' + detail + ')' : ''));
}

// Same capture technique as verify-cycles-graph-fit.mjs (see that script's
// own comment) - stashes the live cytoscape() instance on window without
// touching template.ts.
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

// cose (Focus's own layout) has no fixed iteration count - poll zoom until
// it stops changing. Same technique AND the same baseline-tracking
// requirement as verify-cycles-graph-fit.mjs's own waitForZoomStable, and
// for the identical reason (that script's own comment explains it in
// full): polling for "N equal reads in a row" alone is a race - the first
// few reads are trivially "stable" at the OLD, pre-focus zoom before cose's
// own fit has even started moving it. Confirmed live while building this
// script: without requiring a change from the baseline first, this
// occasionally measured node boxes at the Full Graph's pre-focus zoom
// (~1.5x0.5 rendered px for a real ~44x23 label box) and reported a
// meaningless sub-pixel "overlap" between two unrelated, barely-adjacent
// full-graph nodes - not the real F9 defect.
async function waitForLayoutSettled(page, { pollMs = 60, stableReads = 3, timeoutMs = 8000, baseline } = {}) {
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
                return;
            }
        } else {
            stableCount = 0;
        }
        last = current;
        await page.waitForTimeout(pollMs);
    }
}

// The exact invariant F9 reports broken: no two currently-visible nodes'
// real, rendered boxes should overlap each other. Mirrors the audit's own
// reproduction method (AUDIT_v0.11.0.md F9: "measure
// renderedBoundingBox({includeLabels:false}) pairwise").
async function measureOverlappingPairs(page) {
    return page.evaluate(() => {
        const cy = window.__testCy;
        const visible = cy.nodes().filter((n) => !n.hasClass('not-in-view') && !n.data('isExternalProxy'));
        const boxes = visible.map((n) => ({ id: n.id(), bb: n.renderedBoundingBox({ includeLabels: false }) }));

        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i].bb;
                const b = boxes[j].bb;
                const intersects = a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
                if (intersects) {
                    overlaps.push([boxes[i].id, boxes[j].id]);
                }
            }
        }

        return { visibleCount: visible.length, overlaps };
    });
}

async function main() {
    const executablePath = resolveChromiumExecutable();
    if (!executablePath) {
        console.error('No cached Chromium found. Run `npx playwright install chromium`, or set PLAYWRIGHT_CHROMIUM_PATH.');
        process.exit(1);
    }

    const cyclesLargeReport = generateReport(CYCLES_LARGE_DIR);
    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

    // --- F9: the largest SCC's Focused Graph must render with no two
    // nodes overlapping each other (the cycle's own core members, in
    // particular - the audit's own worked example found the two members
    // of the cycle itself drawn on top of each other). ---
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
        await waitForLayoutSettled(page, { baseline: preFocusZoom });

        const { visibleCount, overlaps } = await measureOverlappingPairs(page);
        record('hub Focused Graph has a non-trivial visible node set to check', visibleCount > 1, 'visibleCount=' + visibleCount);
        record(
            'hub Focused Graph: no two visible nodes render on top of each other',
            overlaps.length === 0,
            overlaps.length > 0 ? `${overlaps.length} overlapping pair(s), e.g. ${JSON.stringify(overlaps.slice(0, 3))}` : ''
        );

        await context.close();
    }

    await browser.close();
    fs.rmSync(path.join(CYCLES_LARGE_DIR, 'dep-health-reports'), { recursive: true, force: true });

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
