import fg from 'fast-glob';
import path from 'node:path';

export async function discoverFiles(root: string, exclude: string[] = []): Promise<string[]> {
    // `.mts`/`.cts` are TypeScript source extensions (same standing as
    // `.ts`/`.tsx`), required by "nodenext"/"node16" module resolution -
    // `resolve.ts` already resolves `import './x.mjs'` to a real `x.mts`
    // file, but until this file itself was discoverable, its own outgoing
    // imports were never scanned, silently dropping edges (and cycles)
    // that pass through it. See README's Import Resolution section, which
    // already promises `.mts`/`.cts` support.
    //
    // `exclude` (config: top-level `exclude`, shared by every command) is
    // appended to, never replaces, the built-in ignore list below - a
    // project can add its own excludes but can't accidentally un-ignore
    // node_modules/dist/build by omitting them. This is a config-driven
    // escape hatch, not general `.gitignore` awareness - the scanner still
    // doesn't read `.gitignore` on its own.
    const files = await fg(['**/*.{js,jsx,ts,tsx,mts,cts}'], {
        cwd: root,
        absolute: true,
        followSymbolicLinks: false,
        ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/*.test.{js,jsx,ts,tsx,mts,cts}',
            '**/*.spec.{js,jsx,ts,tsx,mts,cts}',
            '**/__fixtures__/**',
            '**/coverage/**',
            '**/static/**',
            '**/dep-health-reports/**',
            ...exclude,
        ],
        dot: false,
    });

    return files.map((file) => path.normalize(file));
}
