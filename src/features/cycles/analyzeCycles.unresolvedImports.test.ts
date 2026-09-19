import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MODES } from '@shared/types';

// `./metrics/report` imports `chalk`, an ESM-only package - Jest's default
// CJS transform can't parse it (the same constraint documented in F2's
// engines.node work: this package only runs under real Node's
// require(esm), not under ts-jest). analyzeCycles.test.ts mocks this same
// module for the same reason. Everything else below (scanProject, the
// resolver, findSCCs, buildCytoscapeElements, generateHtml, the real HTML
// template) is intentionally left real.
jest.mock('./metrics/report', () => ({ printMetricsSummary: jest.fn() }));

import { analyzeCycles } from './analyzeCycles';

// End-to-end regression coverage for F1 (unresolvedImports): real
// scanProject, real resolver, real HTML template - only the
// chalk-dependent report printer above is mocked. Unlike
// analyzeCycles.test.ts (which mocks scanProject to isolate CLI/report
// wiring from scanning), this file exists specifically to prove the real
// wiring between scanProject's unresolvedImports and what the CLI/HTML
// actually show, using on-disk fixtures.
describe('analyzeCycles - unresolved imports (F1, real scanner, real HTML)', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-analyzecycles-unresolved-'));
        jest.spyOn(console, 'log').mockImplementation(() => {});
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

    describe('CLI warning (compact mode)', () => {
        it('warns that analysis is incomplete when a relative import cannot be resolved', async () => {
            fs.writeFileSync(
                path.join(root, 'a.ts'),
                `import { foo } from './missing';\nexport const x = foo;\n`
            );
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.COMPACT,
                htmlReportOutputPath: path.join(root, 'out.html'),
            });

            const warnedIncomplete = warnSpy.mock.calls.some(
                ([message]) =>
                    typeof message === 'string' && /unresolved/i.test(message) && message.includes('1')
            );
            expect(warnedIncomplete).toBe(true);
        });

        it('does not warn about incomplete analysis when every import resolves', async () => {
            fs.writeFileSync(path.join(root, 'a.ts'), `import { b } from './b';\nexport const a = b;\n`);
            fs.writeFileSync(path.join(root, 'b.ts'), `export const b = 1;\n`);
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.COMPACT,
                htmlReportOutputPath: path.join(root, 'out.html'),
            });

            const warnedIncomplete = warnSpy.mock.calls.some(
                ([message]) => typeof message === 'string' && /unresolved/i.test(message)
            );
            expect(warnedIncomplete).toBe(false);
        });
    });

    describe('HTML report', () => {
        it('includes the unresolved specifier and an incomplete-analysis indicator, while a resolved module stays visible', async () => {
            fs.writeFileSync(
                path.join(root, 'a.ts'),
                `import { b } from './b';\nimport { c } from './missing';\nexport const a = b + c;\n`
            );
            fs.writeFileSync(path.join(root, 'b.ts'), `export const b = 1;\n`);
            jest.spyOn(console, 'warn').mockImplementation(() => {});

            const outputPath = path.join(root, 'report', 'index.html');

            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.HTML,
                htmlReportOutputPath: outputPath,
            });

            const html = fs.readFileSync(outputPath, 'utf-8');

            expect(html).toContain('./missing');
            expect(html).toMatch(/incomplete/i);
            expect(html).toContain('b.ts');
        });

        it('shows no incomplete-analysis indicator when every import resolves', async () => {
            fs.writeFileSync(path.join(root, 'a.ts'), `import { b } from './b';\nexport const a = b;\n`);
            fs.writeFileSync(path.join(root, 'b.ts'), `export const b = 1;\n`);
            jest.spyOn(console, 'warn').mockImplementation(() => {});

            const outputPath = path.join(root, 'report', 'index.html');

            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.HTML,
                htmlReportOutputPath: outputPath,
            });

            const html = fs.readFileSync(outputPath, 'utf-8');

            expect(html).not.toMatch(/incomplete/i);
        });

        // F30: mirrors F17's fix for the CLI/report metrics display (both
        // already show a root-relative path, never a bare basename that
        // collides for two files sharing a filename) - the HTML
        // unresolved-imports warning added by F1 still used
        // path.basename(entry.file) alone, so src/foo/index.ts and
        // src/bar/index.ts both rendered as the exact same ambiguous
        // "index.ts", with no way to tell which file the warning is about.
        it('shows an unambiguous root-relative path for each entry, not a same-basename-colliding basename, when two unresolved-import files share a filename', async () => {
            fs.mkdirSync(path.join(root, 'src', 'foo'), { recursive: true });
            fs.mkdirSync(path.join(root, 'src', 'bar'), { recursive: true });
            fs.writeFileSync(
                path.join(root, 'src', 'foo', 'index.ts'),
                `import { x } from './missing';\nexport const foo = x;\n`
            );
            fs.writeFileSync(
                path.join(root, 'src', 'bar', 'index.ts'),
                `import { x } from './missing';\nexport const bar = x;\n`
            );
            jest.spyOn(console, 'warn').mockImplementation(() => {});

            const outputPath = path.join(root, 'report', 'index.html');

            await analyzeCycles({
                ...baseArgs,
                target: root,
                mode: MODES.HTML,
                htmlReportOutputPath: outputPath,
            });

            const html = fs.readFileSync(outputPath, 'utf-8');

            expect(html).toContain('src/foo/index.ts');
            expect(html).toContain('src/bar/index.ts');
            // The bug this guards against: both entries collapse to the
            // exact same bare "index.ts" label.
            expect(html.match(/<code>index\.ts<\/code>/g)).toBeNull();
        });
    });
});
