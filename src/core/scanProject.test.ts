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

    describe('unresolvedImports (F1)', () => {
        // "Resolved" here means exactly what resolveImport() (resolve.ts)
        // already means: a relative specifier that maps to a real file on
        // disk. A relative specifier that does NOT map to a real file is a
        // genuine defect worth surfacing - unlike a bare/external
        // specifier (e.g. a real npm package), which resolveImport()
        // already treats as an intentional "EXTERNAL SKIP", not a failure.
        // F1 only turns the first case into visible, structured
        // information; the second case's existing behavior is locked by
        // its own test below, unchanged.
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-scanproject-unresolved-'));
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('records which file and specifier failed to resolve for a single unresolved relative import', async () => {
            fs.writeFileSync(
                path.join(root, 'a.ts'),
                `import { foo } from './does-not-exist';\nexport const x = foo;\n`
            );

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.unresolvedImports).toEqual([
                { file: path.join(root, 'a.ts'), specifier: './does-not-exist' },
            ]);
        });

        it('keeps a resolved import out of unresolvedImports and still builds its graph edge, while separately recording the missing one', async () => {
            fs.writeFileSync(
                path.join(root, 'a.ts'),
                `import { existing } from './existing';\nimport { bar } from './missing';\nexport const x = existing + bar;\n`
            );
            fs.writeFileSync(path.join(root, 'existing.ts'), `export const existing = 1;\n`);

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.unresolvedImports).toEqual([
                { file: path.join(root, 'a.ts'), specifier: './missing' },
            ]);
            expect(result.graph.edges.get(path.join(root, 'a.ts'))).toEqual(
                new Set([path.join(root, 'existing.ts')])
            );
        });

        it('collects multiple unresolved imports in deterministic (file, then specifier) order', async () => {
            // Written in reverse (b before a) so a pass here can only be
            // explained by an explicit sort, never by source/insertion
            // order happening to already match.
            fs.writeFileSync(path.join(root, 'a.ts'), `import './missing-b';\nimport './missing-a';\n`);

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.unresolvedImports).toEqual([
                { file: path.join(root, 'a.ts'), specifier: './missing-a' },
                { file: path.join(root, 'a.ts'), specifier: './missing-b' },
            ]);
        });

        it('is an empty array when every import resolves', async () => {
            fs.writeFileSync(path.join(root, 'a.ts'), `import { b } from './b';\nexport const a = b;\n`);
            fs.writeFileSync(path.join(root, 'b.ts'), `export const b = 1;\n`);

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.unresolvedImports).toEqual([]);
        });

        it('does not add the missing specifier as a graph node or a graph edge', async () => {
            fs.writeFileSync(
                path.join(root, 'a.ts'),
                `import { foo } from './missing';\nexport const x = foo;\n`
            );

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.graph.edges.get(path.join(root, 'a.ts'))).toBeUndefined();

            for (const node of result.graph.nodes) {
                expect(node).not.toMatch(/missing/);
            }
        });

        it('does not treat an unresolved bare/external specifier as an unresolved import (existing EXTERNAL SKIP behavior, unchanged)', async () => {
            fs.writeFileSync(
                path.join(root, 'a.ts'),
                `import x from 'some-external-package';\nexport const y = x;\n`
            );

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.unresolvedImports).toEqual([]);
        });

        describe('CommonJS require() (documents current behavior only - out of scope for F1)', () => {
            // extractImports() (extract.ts) only reads ts-morph
            // ImportDeclaration/ExportDeclaration nodes - a require() call
            // is a plain CallExpression and is never visited at all, so it
            // produces neither a graph edge nor an unresolvedImports entry,
            // resolved or not. This test locks that existing behavior; it
            // is not new functionality.
            it('does not see a require() of a missing module at all - no edge, no unresolvedImports entry', async () => {
                fs.writeFileSync(
                    path.join(root, 'a.ts'),
                    `const foo = require('./missing');\nexports.x = foo;\n`
                );

                const result = await scanProject({ projectRoot: root, scanRoot: root });

                expect(result.unresolvedImports).toEqual([]);
                expect(result.graph.edges.get(path.join(root, 'a.ts'))).toBeUndefined();
            });
        });
    });

    describe('exclude (config: top-level exclude, shared by every command)', () => {
        // A real gap found while dogfooding: dep-health's own repo scanning
        // itself was silently sweeping up the entire test-projects/ external
        // validation corpus as if it were project source. discoverFiles()'s
        // own `exclude` param only keeps an excluded file from being
        // scanned as a *source* of its own imports - it says nothing about
        // a *resolved import target*. Without the check in scanProject.ts,
        // a file outside the excluded path that still imports something
        // inside it would add the "excluded" file straight back into the
        // graph as a node, defeating the point of excluding it at all.
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-scanproject-exclude-'));
            fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('does not add an excluded file to the graph even when a kept file still imports it', async () => {
            fs.writeFileSync(
                path.join(root, 'main.ts'),
                `import { helper } from './vendor/helper';\nexport const x = helper;\n`
            );
            fs.writeFileSync(path.join(root, 'vendor', 'helper.ts'), `export const helper = 1;\n`);

            const result = await scanProject({ projectRoot: root, scanRoot: root, exclude: ['vendor/**'] });

            expect(result.scannedFiles).toBe(1);
            expect(result.graph.nodes.has(path.join(root, 'vendor', 'helper.ts'))).toBe(false);

            let edgesCount = 0;
            for (const deps of result.graph.edges.values()) {
                edgesCount += deps.size;
            }
            expect(edgesCount).toBe(0);
        });

        it('scans everything, unaffected, when exclude is omitted', async () => {
            fs.writeFileSync(
                path.join(root, 'main.ts'),
                `import { helper } from './vendor/helper';\nexport const x = helper;\n`
            );
            fs.writeFileSync(path.join(root, 'vendor', 'helper.ts'), `export const helper = 1;\n`);

            const result = await scanProject({ projectRoot: root, scanRoot: root });

            expect(result.scannedFiles).toBe(2);
            expect(result.graph.nodes.has(path.join(root, 'vendor', 'helper.ts'))).toBe(true);
        });
    });
});
