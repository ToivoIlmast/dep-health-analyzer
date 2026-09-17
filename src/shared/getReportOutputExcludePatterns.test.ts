import path from 'node:path';
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

    it('excludes exactly the file and an "assets/**" pattern (not the whole containing directory) when outputPath sits directly at scanRoot', () => {
        // The literal scenario from the task: project/report.html next to
        // project/src - excluding the whole scanRoot directory here would
        // wipe out the entire scan, so only the specific file (and the
        // fixed "assets" subdirectory copyAssets.ts writes into) may be
        // excluded, never scanRoot itself.
        const patterns = getReportOutputExcludePatterns('/project', '/project/report.html');

        expect(patterns).toEqual(['report.html', 'assets/**']);
    });

    it('excludes the file and a nested "<dir>/assets/**" pattern when outputPath is in a subdirectory', () => {
        const patterns = getReportOutputExcludePatterns(
            '/project',
            '/project/dep-health-reports/scc.html'
        );

        expect(patterns).toEqual(['dep-health-reports/scc.html', 'dep-health-reports/assets/**']);
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

        expect(relative).toEqual(['dep-health-reports/scc.html', 'dep-health-reports/assets/**']);
        expect(absolute).toEqual(relative);
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
