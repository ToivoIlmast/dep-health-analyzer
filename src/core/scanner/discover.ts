import fg from 'fast-glob';
import path from 'node:path';

export async function discoverFiles(root: string): Promise<string[]> {
    // `.mts`/`.cts` are TypeScript source extensions (same standing as
    // `.ts`/`.tsx`), required by "nodenext"/"node16" module resolution -
    // `resolve.ts` already resolves `import './x.mjs'` to a real `x.mts`
    // file, but until this file itself was discoverable, its own outgoing
    // imports were never scanned, silently dropping edges (and cycles)
    // that pass through it. See README's Import Resolution section, which
    // already promises `.mts`/`.cts` support.
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
        ],
        dot: false,
    });

    return files.map((file) => path.normalize(file));
}
