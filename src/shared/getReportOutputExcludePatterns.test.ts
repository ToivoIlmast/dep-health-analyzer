import path from 'node:path';
import { minimatch } from 'minimatch';
import { getReportOutputExcludePatterns } from './getReportOutputExcludePatterns';

describe('getReportOutputExcludePatterns (F4/F26)', () => {
    // outputPath (like generateHtml.ts / htmlModeReport.ts's own
    // `path.resolve(outputPath)`) is resolved relative to process.cwd().
    // Note: in this environment jest.spyOn(process, 'cwd') does NOT affect
    // path.resolve()'s internal cwd lookup (Node's path module captures it
    // via a primordial reference at startup, not a live property read) -
    // confirmed directly before writing these tests. So every case here
    // uses already-absolute scanRoot/outputPath values instead of relying
    // on a mocked cwd, which would silently test nothing.

    it('excludes exactly the file and the exact vendored asset files (not the whole containing directory, not a directory-wide glob) when outputPath sits directly at scanRoot', () => {
        // The literal scenario from the task: project/report.html next to
        // project/src - excluding the whole scanRoot directory here would
        // wipe out the entire scan, so only the specific file (and the
        // exact vendored files copyAssets.ts writes into "assets/") may be
        // excluded, never scanRoot itself and never a directory-wide
        // "assets/**" glob (that would also swallow a real user
        // src/assets/ source directory - see the dedicated describe block
        // below).
        const patterns = getReportOutputExcludePatterns('/project', '/project/report.html');

        expect(patterns).toEqual([
            'report.html',
            'assets/cytoscape.min.js',
            'assets/dagre.min.js',
            'assets/cytoscape-dagre.js',
        ]);
    });

    it('excludes the file and the exact nested "<dir>/assets/<file>" vendored files when outputPath is in a subdirectory', () => {
        const patterns = getReportOutputExcludePatterns(
            '/project',
            '/project/dep-health-reports/scc.html'
        );

        expect(patterns).toEqual([
            'dep-health-reports/scc.html',
            'dep-health-reports/assets/cytoscape.min.js',
            'dep-health-reports/assets/dagre.min.js',
            'dep-health-reports/assets/cytoscape-dagre.js',
        ]);
    });

    it('returns no patterns when outputPath resolves outside scanRoot (nothing to exclude - discovery never scans outside root anyway)', () => {
        const patterns = getReportOutputExcludePatterns(
            '/project/src',
            '/project/dep-health-reports/scc.html'
        );

        expect(patterns).toEqual([]);
    });

    it('resolves a relative outputPath the same way as the equivalent absolute one, using the REAL process.cwd()', () => {
        const scanRoot = process.cwd();
        const relative = getReportOutputExcludePatterns(scanRoot, './dep-health-reports/scc.html');
        const absolute = getReportOutputExcludePatterns(
            scanRoot,
            path.join(scanRoot, 'dep-health-reports', 'scc.html')
        );

        expect(relative).toEqual([
            'dep-health-reports/scc.html',
            'dep-health-reports/assets/cytoscape.min.js',
            'dep-health-reports/assets/dagre.min.js',
            'dep-health-reports/assets/cytoscape-dagre.js',
        ]);
        expect(absolute).toEqual(relative);
    });

    describe('does not shadow a real user "assets" directory (F4 false-negative fix)', () => {
        // The bug the final audit found: `assets/**` is a directory-wide
        // glob, so it also swallows a genuine project source directory
        // that happens to be named "assets" - e.g. `src/assets/icons.ts` -
        // whenever it sits next to outputPath. The fix must name only the
        // exact files copyAssets.ts actually writes (mirroring the
        // `<script src="./assets/...">` list in template.ts), never a
        // directory-wide glob.

        it('never returns a directory-wide "assets/**" glob, at scanRoot', () => {
            const patterns = getReportOutputExcludePatterns('/project', '/project/report.html');

            expect(patterns).not.toContain('assets/**');
            // A user file like assets/icons.ts must not match ANY returned
            // pattern - that's the actual thing under test, not just the
            // literal string "assets/**".
            for (const pattern of patterns) {
                expect(minimatch('assets/icons.ts', pattern)).toBe(false);
                expect(minimatch('assets/logo.ts', pattern)).toBe(false);
            }
        });

        it('never returns a directory-wide "<dir>/assets/**" glob, in a subdirectory - the literal "./src/report.html" scenario from the audit', () => {
            const patterns = getReportOutputExcludePatterns('/project', '/project/src/report.html');

            expect(patterns).not.toContain('src/assets/**');
            for (const pattern of patterns) {
                expect(minimatch('src/assets/icons.ts', pattern)).toBe(false);
                expect(minimatch('src/assets/logo.ts', pattern)).toBe(false);
            }
        });

        it('still excludes the exact vendored asset files copyAssets.ts writes (cytoscape.min.js/dagre.min.js/cytoscape-dagre.js), at scanRoot', () => {
            const patterns = getReportOutputExcludePatterns('/project', '/project/report.html');

            expect(patterns).toContain('assets/cytoscape.min.js');
            expect(patterns).toContain('assets/dagre.min.js');
            expect(patterns).toContain('assets/cytoscape-dagre.js');
        });

        it('still excludes the exact vendored asset files in a subdirectory', () => {
            const patterns = getReportOutputExcludePatterns('/project', '/project/src/report.html');

            expect(patterns).toContain('src/assets/cytoscape.min.js');
            expect(patterns).toContain('src/assets/dagre.min.js');
            expect(patterns).toContain('src/assets/cytoscape-dagre.js');
        });
    });

    describe('idempotency / purity (F4/F26 part C)', () => {
        it('returns an equal result every time for the same inputs, without mutating anything shared', () => {
            const first = getReportOutputExcludePatterns(
                '/project',
                '/project/dep-health-reports/scc.html'
            );
            const second = getReportOutputExcludePatterns(
                '/project',
                '/project/dep-health-reports/scc.html'
            );

            expect(second).toEqual(first);
            // Not the same array instance - callers must be free to
            // concat/spread the result without risking a later call
            // observing a mutation made by an earlier caller.
            expect(second).not.toBe(first);
        });
    });
});
