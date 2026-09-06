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
