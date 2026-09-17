import path from 'node:path';

/**
 * Glob patterns (relative to scanRoot, in the same shape as the existing
 * `exclude` config contract) for the HTML report a command is about to
 * write (or may already have written on a previous run) - so a scan never
 * re-discovers the tool's own output as project source (F4/F26).
 *
 * Excludes the exact report file plus a fixed "assets/**" subdirectory
 * next to it (copyAssets.ts always copies the vendored cytoscape/dagre
 * scripts into an `assets/` folder beside the report, for `cycles`'
 * HTML report specifically) - never the whole containing directory,
 * since outputPath can legitimately sit AT scanRoot itself (e.g.
 * `project/report.html` next to `project/src/`), where excluding the
 * entire directory would wipe out the scan.
 *
 * Safe to call unconditionally, whether or not the report currently
 * exists on disk, and whether or not HTML reporting is even enabled this
 * run - a pattern that matches nothing is a no-op.
 */
export function getReportOutputExcludePatterns(scanRoot: string, outputPath: string): string[] {
    const absoluteOutputPath = path.resolve(outputPath);
    const relativeOutputPath = path.relative(scanRoot, absoluteOutputPath).replaceAll('\\', '/');

    if (relativeOutputPath.startsWith('..') || path.isAbsolute(relativeOutputPath)) {
        // outputPath resolves outside scanRoot - discovery never scans
        // outside root in the first place, so there's nothing to exclude.
        return [];
    }

    const relativeDir = path.dirname(relativeOutputPath);
    const assetsPattern = relativeDir === '.' ? 'assets/**' : `${relativeDir}/assets/**`;

    return [relativeOutputPath, assetsPattern];
}
