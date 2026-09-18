import path from 'node:path';

// The exact filenames copyAssets.ts copies into the `assets/` folder it
// writes beside the HTML report - the same three files template.ts's own
// `<script src="./assets/...">` tags reference (see copyAssets.ts and
// template.ts). Naming these exactly (rather than a directory-wide
// "assets/**" glob) is the whole fix for F4's false negative: a glob
// can't tell the report's own output apart from a real project source
// directory that happens to be named "assets" (e.g. `src/assets/icons.ts`
// next to an `outputPath` of `src/report.html`) and would wipe it out of
// the scan.
const REPORT_ASSET_FILENAMES = ['cytoscape.min.js', 'dagre.min.js', 'cytoscape-dagre.js'];

/**
 * Glob patterns (relative to scanRoot, in the same shape as the existing
 * `exclude` config contract) for the HTML report a command is about to
 * write (or may already have written on a previous run) - so a scan never
 * re-discovers the tool's own output as project source (F4/F26).
 *
 * Excludes the exact report file plus the exact vendored asset files
 * copyAssets.ts writes next to it - never a directory-wide "assets/**"
 * glob (see REPORT_ASSET_FILENAMES) and never the whole containing
 * directory, since outputPath can legitimately sit AT scanRoot itself
 * (e.g. `project/report.html` next to `project/src/`), where excluding
 * the entire directory would wipe out the scan.
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
    const assetsDir = relativeDir === '.' ? 'assets' : `${relativeDir}/assets`;
    const assetPatterns = REPORT_ASSET_FILENAMES.map((filename) => `${assetsDir}/${filename}`);

    return [relativeOutputPath, ...assetPatterns];
}
