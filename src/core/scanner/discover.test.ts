import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverFiles } from './discover';

describe('discoverFiles', () => {
    it('should find ts files', async () => {
        const result = await discoverFiles(path.resolve('src/core/scanner/__fixtures__/simple'));

        expect(result.length).toBeGreaterThan(0);
    });

    it('should return normalized absolute paths', async () => {
        const result = await discoverFiles(path.resolve('src/core/scanner/__fixtures__/simple'));

        expect(path.isAbsolute(result[0]!)).toBe(true);
    });

    it('should ignore node_modules directory', async () => {
        const result = await discoverFiles(path.resolve('src/core/scanner/__fixtures__'));

        const hasNodeModules = result.some((file) => file.includes('node_modules'));

        expect(hasNodeModules).toBe(false);
    });

    describe('ignoring test files across all scanned extensions', () => {
        // A real, confirmed asymmetry: only `.test.ts`/`.spec.ts` were ever
        // excluded, so `.test.tsx` (a very common React component test
        // pattern), `.test.js`, `.test.jsx`, and their `.spec.*`
        // counterparts all leaked into the dependency graph as ordinary
        // source files - polluting findings/cycles for JS and .tsx-tested
        // projects while TS-only-tested projects were unaffected.
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-discover-testfiles-'));
            fs.mkdirSync(path.join(root, 'src'), { recursive: true });
            for (const ext of ['ts', 'tsx', 'js', 'jsx', 'mts', 'cts']) {
                fs.writeFileSync(path.join(root, 'src', `a.test.${ext}`), '');
                fs.writeFileSync(path.join(root, 'src', `b.spec.${ext}`), '');
            }
            fs.writeFileSync(path.join(root, 'src', 'real.ts'), '');
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('excludes .test.* and .spec.* for every scanned extension', async () => {
            const result = await discoverFiles(root);
            const names = result.map((file) => path.basename(file)).sort();

            expect(names).toEqual(['real.ts']);
        });
    });

    describe('ignoring non-source directories', () => {
        // Real directories with real files, not just an assertion against a
        // fixture that never contained the directory in the first place -
        // coverage/static/dep-health-reports don't exist under __fixtures__,
        // so a false-negative test would pass for the wrong reason.
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-discover-'));
            fs.mkdirSync(path.join(root, 'coverage', 'lcov-report'), { recursive: true });
            fs.mkdirSync(path.join(root, 'static', 'assets'), { recursive: true });
            fs.mkdirSync(path.join(root, 'dep-health-reports', 'assets'), { recursive: true });
            fs.mkdirSync(path.join(root, 'src'), { recursive: true });

            fs.writeFileSync(path.join(root, 'coverage', 'lcov-report', 'prettify.js'), '');
            fs.writeFileSync(path.join(root, 'static', 'assets', 'cytoscape.min.js'), '');
            fs.writeFileSync(path.join(root, 'dep-health-reports', 'assets', 'dagre.min.js'), '');
            fs.writeFileSync(path.join(root, 'src', 'index.ts'), '');
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('should not scan coverage/, static/, or dep-health-reports/', async () => {
            const result = await discoverFiles(root);

            expect(result.some((file) => file.includes('coverage'))).toBe(false);
            expect(result.some((file) => file.includes('static'))).toBe(false);
            expect(result.some((file) => file.includes('dep-health-reports'))).toBe(false);
        });

        it('should still scan real source files alongside the ignored directories', async () => {
            const result = await discoverFiles(root);

            expect(result.some((file) => file.endsWith('index.ts'))).toBe(true);
        });
    });

    describe('.mts / .cts source files', () => {
        // Regression coverage for a real false negative: `resolve.ts` already
        // maps `import './x.mjs'` to a real `x.mts` file on disk, but until
        // `.mts`/`.cts` were part of this glob, that file's own imports were
        // never extracted - silently dropping edges (and cycles) that pass
        // through it, even though README's Import Resolution section already
        // promised `.mts`/`.cts` support.
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-discover-mts-cts-'));
            fs.mkdirSync(path.join(root, 'src'), { recursive: true });
            fs.writeFileSync(path.join(root, 'src', 'a.mts'), '');
            fs.writeFileSync(path.join(root, 'src', 'b.cts'), '');
            fs.writeFileSync(path.join(root, 'src', 'c.ts'), '');
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('discovers .mts files', async () => {
            const result = await discoverFiles(root);

            expect(result.some((file) => file.endsWith('a.mts'))).toBe(true);
        });

        it('discovers .cts files', async () => {
            const result = await discoverFiles(root);

            expect(result.some((file) => file.endsWith('b.cts'))).toBe(true);
        });

        it('still discovers plain .ts files alongside .mts/.cts', async () => {
            const result = await discoverFiles(root);

            expect(result.some((file) => file.endsWith('c.ts'))).toBe(true);
            expect(result).toHaveLength(3);
        });
    });

    describe('build output stays excluded even with .mts/.cts included', () => {
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-discover-build-'));
            fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
            fs.mkdirSync(path.join(root, 'build'), { recursive: true });
            fs.mkdirSync(path.join(root, 'node_modules', 'x'), { recursive: true });
            fs.mkdirSync(path.join(root, 'src'), { recursive: true });

            fs.writeFileSync(path.join(root, 'dist', 'compiled.mts'), '');
            fs.writeFileSync(path.join(root, 'build', 'compiled.cts'), '');
            fs.writeFileSync(path.join(root, 'node_modules', 'x', 'index.mts'), '');
            fs.writeFileSync(path.join(root, 'src', 'index.mts'), '');
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('does not scan dist/, build/, or node_modules/ for the new extensions', async () => {
            const result = await discoverFiles(root);

            expect(result.some((file) => file.includes(`${path.sep}dist${path.sep}`))).toBe(false);
            expect(result.some((file) => file.includes(`${path.sep}build${path.sep}`))).toBe(false);
            expect(result.some((file) => file.includes('node_modules'))).toBe(false);
            expect(result.some((file) => file.endsWith('src' + path.sep + 'index.mts'))).toBe(true);
        });
    });

    describe('exclude option (config: top-level `exclude`, shared by every command)', () => {
        // A real gap found while dogfooding: dep-health's own repo scanning
        // itself was silently sweeping up the entire test-projects/ external
        // validation corpus (a gitignored but not scanner-ignored directory)
        // as if it were project source - 397 "scanned files" for a ~140-file
        // real codebase, and every "cycle" the tool reported on itself was
        // actually a deliberately-cyclic corpus fixture, not real dep-health
        // code. There was no config option to add a project-specific
        // exclude before this. `exclude` lives at the config root (not
        // nested per-feature like `typescript.includeTypeOnlyImports`) -
        // what counts as "part of this project" doesn't change depending on
        // which command is scanning it.
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-discover-exclude-'));
            fs.mkdirSync(path.join(root, 'src'), { recursive: true });
            fs.mkdirSync(path.join(root, 'test-projects', 'fixture-a'), { recursive: true });

            fs.writeFileSync(path.join(root, 'src', 'index.ts'), '');
            fs.writeFileSync(path.join(root, 'src', 'specific-file.ts'), '');
            fs.writeFileSync(path.join(root, 'test-projects', 'fixture-a', 'file.ts'), '');
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('scans everything when no exclude is given', async () => {
            const result = await discoverFiles(root);

            expect(result.some((file) => file.includes('test-projects'))).toBe(true);
            expect(result).toHaveLength(3);
        });

        it('excludes a directory glob without touching the built-in ignores', async () => {
            const result = await discoverFiles(root, ['test-projects/**']);

            expect(result.some((file) => file.includes('test-projects'))).toBe(false);
            expect(result.some((file) => file.endsWith('src' + path.sep + 'index.ts'))).toBe(true);
            expect(result).toHaveLength(2);
        });

        it('excludes one specific file by exact relative path', async () => {
            const result = await discoverFiles(root, ['src/specific-file.ts']);

            expect(result.some((file) => file.endsWith('specific-file.ts'))).toBe(false);
            expect(result.some((file) => file.endsWith('src' + path.sep + 'index.ts'))).toBe(true);
            expect(result).toHaveLength(2);
        });

        it('applies multiple exclude patterns together', async () => {
            const result = await discoverFiles(root, ['test-projects/**', 'src/specific-file.ts']);

            expect(result.some((file) => file.includes('test-projects'))).toBe(false);
            expect(result.some((file) => file.endsWith('specific-file.ts'))).toBe(false);
            expect(result.some((file) => file.endsWith('src' + path.sep + 'index.ts'))).toBe(true);
            expect(result).toHaveLength(1);
        });

        it('has no effect when a pattern matches nothing', async () => {
            const result = await discoverFiles(root, ['nonexistent-directory/**']);

            expect(result).toHaveLength(3);
        });
    });

    describe('symlinks', () => {
        let root: string;
        let outside: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-discover-symlink-'));
            outside = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-discover-outside-'));

            fs.mkdirSync(path.join(root, 'src'), { recursive: true });
            fs.writeFileSync(path.join(root, 'src', 'index.ts'), '');
            fs.writeFileSync(path.join(outside, 'secret.ts'), '');
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(outside, { recursive: true, force: true });
        });

        it('does not follow a directory symlink to a location outside the scanned project', async () => {
            fs.symlinkSync(outside, path.join(root, 'src', 'linked'), 'dir');

            const result = await discoverFiles(root);

            expect(result.some((file) => file.includes('secret.ts'))).toBe(false);
            expect(result.some((file) => file.endsWith('index.ts'))).toBe(true);
        });

        it('does not follow a self-referential symlink into a duplicate-inflating loop', async () => {
            fs.symlinkSync(path.join(root, 'src'), path.join(root, 'src', 'loop'), 'dir');

            const result = await discoverFiles(root);

            expect(result).toHaveLength(1);
        });
    });
});
