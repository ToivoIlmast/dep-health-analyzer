import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from './scanProject';

describe('scanProject', () => {
    it('should include scan root in result', async () => {
        const projectRoot = path.join('nonexistent-project');
        const scanRoot = path.join(projectRoot, 'src');

        const result = await scanProject({
            projectRoot,
            scanRoot,
        });

        expect(result.root).toBe(path.resolve(scanRoot));
    });

    describe('includeTypeOnlyImports', () => {
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-scanproject-typeonly-'));
            fs.writeFileSync(path.join(root, 'a.ts'), `import type { B } from './b';\nexport type A = { b?: B };\n`);
            fs.writeFileSync(path.join(root, 'b.ts'), `import type { A } from './a';\nexport type B = { a?: A };\n`);
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('excludes a cycle that exists purely through type-only imports by default', async () => {
            const result = await scanProject({ projectRoot: root, scanRoot: root });

            let edgesCount = 0;
            for (const deps of result.graph.edges.values()) {
                edgesCount += deps.size;
            }

            expect(edgesCount).toBe(0);
        });

        it('includes it when includeTypeOnlyImports is true', async () => {
            const result = await scanProject({
                projectRoot: root,
                scanRoot: root,
                includeTypeOnlyImports: true,
            });

            let edgesCount = 0;
            for (const deps of result.graph.edges.values()) {
                edgesCount += deps.size;
            }

            expect(edgesCount).toBe(2);
        });
    });

    describe('.mts / .cts source files', () => {
        // End-to-end regression coverage for a real false negative:
        // resolveImport() already maps a `.mjs`/`.cjs` specifier to a real
        // `.mts`/`.cts` file on disk, but until discoverFiles() also treated
        // `.mts`/`.cts` as scannable source (not just as a resolution
        // target), that file's own outgoing imports were never extracted -
        // so a real runtime cycle passing through it went completely
        // undetected (0 edges back, 0 cycles, exit 0).
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-scanproject-mts-cts-'));
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('discovers a real runtime cycle from .ts through .mts and back', async () => {
            fs.writeFileSync(path.join(root, 'a.ts'), `import { b } from './b.mjs';\nexport const a = () => b();\n`);
            fs.writeFileSync(path.join(root, 'b.mts'), `import { a } from './a.js';\nexport const b = () => a();\n`);

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.scannedFiles).toBe(2);

            let edgesCount = 0;
            for (const deps of result.graph.edges.values()) {
                edgesCount += deps.size;
            }
            expect(edgesCount).toBe(2);
        });

        it('discovers a real runtime cycle from .ts through .cts and back', async () => {
            fs.writeFileSync(path.join(root, 'a.ts'), `import { b } from './b.cjs';\nexport const a = () => b();\n`);
            fs.writeFileSync(path.join(root, 'b.cts'), `import { a } from './a.js';\nexport const b = () => a();\n`);

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.scannedFiles).toBe(2);

            let edgesCount = 0;
            for (const deps of result.graph.edges.values()) {
                edgesCount += deps.size;
            }
            expect(edgesCount).toBe(2);
        });

        it('resolves a one-way dependency from .mts to a plain .ts file', async () => {
            fs.writeFileSync(path.join(root, 'util.ts'), `export const util = () => 1;\n`);
            fs.writeFileSync(path.join(root, 'consumer.mts'), `import { util } from './util.js';\nexport const c = util();\n`);

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.scannedFiles).toBe(2);

            let edgesCount = 0;
            for (const deps of result.graph.edges.values()) {
                edgesCount += deps.size;
            }
            expect(edgesCount).toBe(1);
        });
    });
});
