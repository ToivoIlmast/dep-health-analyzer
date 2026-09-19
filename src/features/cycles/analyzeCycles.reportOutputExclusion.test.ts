import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MODES } from '@shared/types';

// Same constraint as analyzeCycles.unresolvedImports.test.ts: `./metrics/report`
// imports the ESM-only `chalk`, unparseable by Jest's CJS transform.
jest.mock('./metrics/report', () => ({ printMetricsSummary: jest.fn() }));

import { analyzeCycles } from './analyzeCycles';

// End-to-end regression coverage for F4/F26: the tool's own generated HTML
// report (and, for `cycles`, the vendored JS assets copied alongside it -
// cytoscape.min.js/dagre.min.js/cytoscape-dagre.js - see copyAssets.ts)
// must never be re-discovered as project source on a later scan. Real
// scanProject, real resolver, real generateHtml/copyAssets - nothing
// mocked except the chalk-dependent printer above.
describe('analyzeCycles - report output excluded from analysis (F4/F26)', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-analyzecycles-reportexclude-'));
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    const baseArgs = {
        failOn: 'info' as const,
        enableHtmlReport: true,
        modulesInCyclesThreshold: 0,
    };

    it('does not count its own just-generated HTML report or copied assets when the SAME target is scanned again', async () => {
        fs.writeFileSync(path.join(root, 'a.ts'), `export const a = 1;\n`);
        fs.writeFileSync(path.join(root, 'b.ts'), `import { a } from './a';\nexport const b = a;\n`);

        // outputPath sits directly inside the scanned target, at its root -
        // the exact literal scenario the task describes (project/report.html
        // next to project/src, here project/a.ts + project/b.ts).
        const outputPath = path.join(root, 'report.html');

        const firstRun = await analyzeCycles({
            ...baseArgs,
            target: root,
            mode: MODES.HTML,
            htmlReportOutputPath: outputPath,
        });

        expect(firstRun).toBe(false);
        // Sanity: the report and its assets really were written to disk,
        // inside the scanned target - otherwise this test would prove
        // nothing.
        expect(fs.existsSync(outputPath)).toBe(true);
        expect(fs.existsSync(path.join(root, 'assets', 'cytoscape.min.js'))).toBe(true);

        // Clear the (already-spied, in beforeEach) console.log's call
        // history from the first run - otherwise a later
        // toHaveBeenCalledWith('Scanned files: 2') could pass on the FIRST
        // run's still-recorded call even if the second run logged
        // something else entirely, silently proving nothing.
        (console.log as jest.Mock).mockClear();
        await analyzeCycles({
            ...baseArgs,
            target: root,
            mode: MODES.COMPACT,
            htmlReportOutputPath: outputPath,
        });

        // Only a.ts/b.ts are real source - report.html and assets/*.js must
        // not have joined scannedFiles on this second pass.
        expect(console.log).toHaveBeenCalledWith('Scanned files: 2');
        expect(console.log).toHaveBeenCalledWith('Modules: 2');
    });

    it('does not count a report+assets left over from a PREVIOUS run, even on the very first scan of this call', async () => {
        fs.writeFileSync(path.join(root, 'a.ts'), `export const a = 1;\n`);

        // Simulate a stray report already sitting in the target from an
        // earlier, unrelated invocation - present BEFORE this scan starts,
        // not created by it.
        fs.writeFileSync(path.join(root, 'report.html'), '<html>stale report</html>');
        fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
        fs.writeFileSync(path.join(root, 'assets', 'cytoscape.min.js'), '// stale vendored asset\n');

        const logSpy = jest.spyOn(console, 'log');

        await analyzeCycles({
            ...baseArgs,
            target: root,
            mode: MODES.COMPACT,
            htmlReportOutputPath: path.join(root, 'report.html'),
        });

        expect(logSpy).toHaveBeenCalledWith('Scanned files: 1');
        expect(logSpy).toHaveBeenCalledWith('Modules: 1');
    });

    it('does not count the report when outputPath is a CUSTOM nested subdirectory of the target (not the already-hardcoded-ignored dep-health-reports/ default)', async () => {
        fs.writeFileSync(path.join(root, 'a.ts'), `export const a = 1;\n`);
        fs.writeFileSync(path.join(root, 'b.ts'), `import { a } from './a';\nexport const b = a;\n`);

        // Matches the audit's second reproduction ("generating a report
        // into ./out/") - a custom directory name, deliberately NOT
        // "dep-health-reports" (discover.ts already hardcodes that one
        // specific name, which would make this test pass for the wrong
        // reason and prove nothing about arbitrary/custom outputPath).
        const outputPath = path.join(root, 'out', 'scc.html');

        await analyzeCycles({
            ...baseArgs,
            target: root,
            mode: MODES.HTML,
            htmlReportOutputPath: outputPath,
        });
        expect(fs.existsSync(path.join(root, 'out', 'assets', 'cytoscape.min.js'))).toBe(true);

        (console.log as jest.Mock).mockClear();
        await analyzeCycles({
            ...baseArgs,
            target: root,
            mode: MODES.COMPACT,
            htmlReportOutputPath: outputPath,
        });

        expect(console.log).toHaveBeenCalledWith('Scanned files: 2');
        expect(console.log).toHaveBeenCalledWith('Modules: 2');
    });

    describe('does not shadow a real user "assets" directory (F4 false-negative fix)', () => {
        it('still scans a real user src/assets/ source directory when outputPath sits OUTSIDE src (Case 1)', async () => {
            fs.mkdirSync(path.join(root, 'src', 'assets'), { recursive: true });
            fs.writeFileSync(path.join(root, 'src', 'assets', 'icons.ts'), `export const icons = 1;\n`);
            fs.writeFileSync(path.join(root, 'src', 'assets', 'logo.ts'), `export const logo = 1;\n`);
            fs.writeFileSync(
                path.join(root, 'src', 'index.ts'),
                `import { icons } from './assets/icons';\nimport { logo } from './assets/logo';\nexport const both = icons + logo;\n`
            );

            const outputPath = path.join(root, 'report.html');

            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.COMPACT,
                htmlReportOutputPath: outputPath,
            });

            // 3 real source files (index.ts, assets/icons.ts, assets/logo.ts).
            expect(console.log).toHaveBeenCalledWith('Scanned files: 3');
            expect(console.log).toHaveBeenCalledWith('Modules: 3');
        });

        it('still scans a real user src/assets/ source directory when outputPath sits INSIDE src (Case 3 - the exact "./src/report.html" scenario from the audit)', async () => {
            fs.mkdirSync(path.join(root, 'src', 'assets'), { recursive: true });
            fs.writeFileSync(path.join(root, 'src', 'assets', 'icons.ts'), `export const icons = 1;\n`);
            fs.writeFileSync(path.join(root, 'src', 'assets', 'logo.ts'), `export const logo = 1;\n`);
            fs.writeFileSync(
                path.join(root, 'src', 'index.ts'),
                `import { icons } from './assets/icons';\nimport { logo } from './assets/logo';\nexport const both = icons + logo;\n`
            );

            // outputPath is INSIDE src/, right next to the real assets/
            // directory - the literal false-negative the audit found:
            // "src/assets/**" used to also match this real source dir.
            const outputPath = path.join(root, 'src', 'report.html');

            // First, actually generate the report (+ its own vendored
            // assets) into src/, next to the real assets/ directory -
            // mirroring the two-phase pattern used by the other tests in
            // this file (HTML mode writes the report, then a COMPACT
            // rescan checks it wasn't re-discovered as source).
            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.HTML,
                htmlReportOutputPath: outputPath,
            });
            expect(fs.existsSync(path.join(root, 'src', 'assets', 'cytoscape.min.js'))).toBe(true);

            (console.log as jest.Mock).mockClear();
            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.COMPACT,
                htmlReportOutputPath: outputPath,
            });

            expect(console.log).toHaveBeenCalledWith('Scanned files: 3');
            expect(console.log).toHaveBeenCalledWith('Modules: 3');
        });

        it('does not drop a dependency finding rooted in a source file under assets/ just because outputPath moved (Case 4 - regression)', async () => {
            fs.mkdirSync(path.join(root, 'src', 'assets'), { recursive: true });
            fs.writeFileSync(path.join(root, 'src', 'assets', 'util.ts'), `export const util = 1;\n`);
            fs.writeFileSync(
                path.join(root, 'src', 'index.ts'),
                `import { util } from './assets/util';\nexport const value = util;\n`
            );

            const outsideOutputPath = path.join(root, 'report.html');
            const outsideResult = await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.COMPACT,
                htmlReportOutputPath: outsideOutputPath,
            });

            (console.log as jest.Mock).mockClear();
            const insideOutputPath = path.join(root, 'src', 'report.html');
            const insideResult = await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.COMPACT,
                htmlReportOutputPath: insideOutputPath,
            });

            // Same source, same real dependency - only outputPath moved.
            // The finding (and pass/fail result) must not change.
            expect(console.log).toHaveBeenCalledWith('Scanned files: 2');
            expect(console.log).toHaveBeenCalledWith('Modules: 2');
            expect(console.log).toHaveBeenCalledWith('Dependencies: 1');
            expect(insideResult).toBe(outsideResult);
        });
    });

    describe('idempotency / non-mutation (F4/F26 part C)', () => {
        it('does not mutate or grow a shared exclude array across repeated calls, and produces the same scan result both times', async () => {
            fs.writeFileSync(path.join(root, 'a.ts'), `export const a = 1;\n`);
            fs.writeFileSync(path.join(root, 'b.ts'), `import { a } from './a';\nexport const b = a;\n`);

            const outputPath = path.join(root, 'dep-health-reports', 'custom.html');
            // The SAME array reference config.exclude would be in a real
            // run (routeCommand.ts passes config.exclude straight through
            // on every invocation) - if the output-exclusion patterns were
            // ever appended via mutation (e.g. `exclude.push(...)`) instead
            // of building a new array, this same array would keep growing
            // on every subsequent call within one process.
            const sharedExclude = ['vendor/**'];

            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.COMPACT,
                htmlReportOutputPath: outputPath,
                exclude: sharedExclude,
            });

            expect(sharedExclude).toEqual(['vendor/**']);

            (console.log as jest.Mock).mockClear();
            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.COMPACT,
                htmlReportOutputPath: outputPath,
                exclude: sharedExclude,
            });

            expect(sharedExclude).toEqual(['vendor/**']);
            expect(console.log).toHaveBeenCalledWith('Scanned files: 2');
            expect(console.log).toHaveBeenCalledWith('Modules: 2');
        });
    });
});
