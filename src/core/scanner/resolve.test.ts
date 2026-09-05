import path from 'node:path';
import { resolveImport } from './resolve';

describe('resolveImport', () => {
    it.each([
        ['ts-import.ts', './a1', 'a1.ts'],
        ['tsx-import.tsx', './a2', 'a2.tsx'],
        ['js-import.js', './a3', 'a3.js'],
        ['jsx-import.jsx', './a4', 'a4.jsx'],
    ])('should resolve %s import', (fromFile, specifier, expected) => {
        const result = resolveImport({
            fromFile: path.resolve(`src/core/scanner/__fixtures__/resolve/${fromFile}`),
            specifier,
        });

        expect(result).not.toBeNull();
        expect(result!).toContain(expected);
    });

    it('should resolve index.ts file', () => {
        const fromFile = path.resolve(
            'src/core/scanner/__fixtures__/resolve/ts-index/index-import.ts'
        );

        const result = resolveImport({ fromFile, specifier: './a5' });

        expect(result).not.toBeNull();
        expect(result!).toContain(path.join('a5', 'index.ts'));
    });

    it('should return null for external package import', () => {
        const fromFile = path.resolve(
            'src/core/scanner/__fixtures__/resolve/external-package-import.ts'
        );

        const result = resolveImport({ fromFile, specifier: 'node:path' });

        expect(result).toBeNull();
    });

    it('should return null when file does not exist', () => {
        const tsImports = 'src/core/scanner/__fixtures__/resolve/ts-import.ts';
        const result = resolveImport({ fromFile: path.resolve(tsImports), specifier: './b' });

        expect(result).toBeNull();
    });

    it('should resolve alias without wildcard', () => {
        const fromFile = path.resolve('src/core/scanner/__fixtures__/resolve/ts-import.ts');

        const result = resolveImport({
            fromFile,
            specifier: '@shared',
            tsconfig: {
                baseDir: path.resolve('src/core/scanner/__fixtures__/resolve'),
                baseUrl: '.',
                paths: {
                    '@shared': ['shared/index.ts'],
                },
            },
        });

        expect(result).not.toBeNull();
        expect(result!).toContain(path.join('shared', 'index.ts'));
    });

    it('should resolve wildcard alias', () => {
        const fromFile = path.resolve('src/core/scanner/__fixtures__/resolve/ts-import.ts');

        const result = resolveImport({
            fromFile,
            specifier: '@core/utils',
            tsconfig: {
                baseDir: path.resolve('src/core/scanner/__fixtures__/resolve'),
                baseUrl: '.',
                paths: {
                    '@core/*': ['core/*'],
                },
            },
        });

        expect(result).not.toBeNull();
        expect(result!).toContain(path.join('core', 'utils.ts'));
    });

    it('should return null for unknown alias', () => {
        const fromFile = path.resolve('src/core/scanner/__fixtures__/resolve/ts-import.ts');

        const result = resolveImport({
            fromFile,
            specifier: '@unknown/foo',
            tsconfig: {
                baseDir: path.resolve('src/core/scanner/__fixtures__/resolve'),
                baseUrl: '.',
                paths: {
                    '@core/*': ['core/*'],
                },
            },
        });

        expect(result).toBeNull();
    });

    describe('TypeScript "nodenext"/"node16" output-extension specifiers', () => {
        // Relative ESM imports under nodenext/node16 module resolution
        // must name the *compiled output* extension, not the source file
        // on disk - `import { x } from './helper.js'` legitimately means
        // `./helper.ts`. Without this, the import silently fails to
        // resolve (treated as if unresolvable/external) with zero
        // diagnostic, since it's a relative specifier and never reaches
        // the EXTERNAL SKIP debug log that only fires for bare specifiers.
        const dir = 'src/core/scanner/__fixtures__/resolve/nodenext';

        it('resolves a .js specifier to its real .ts source file', () => {
            const result = resolveImport({
                fromFile: path.resolve(`${dir}/consumer.ts`),
                specifier: './helper.js',
            });

            expect(result).not.toBeNull();
            expect(result!).toContain(path.join('nodenext', 'helper.ts'));
        });

        it('resolves a .mjs specifier to its real .mts source file', () => {
            const result = resolveImport({
                fromFile: path.resolve(`${dir}/consumer.ts`),
                specifier: './mjs-target.mjs',
            });

            expect(result).not.toBeNull();
            expect(result!).toContain(path.join('nodenext', 'mjs-target.mts'));
        });

        it('resolves a .cjs specifier to its real .cts source file', () => {
            const result = resolveImport({
                fromFile: path.resolve(`${dir}/consumer.ts`),
                specifier: './cjs-target.cjs',
            });

            expect(result).not.toBeNull();
            expect(result!).toContain(path.join('nodenext', 'cjs-target.cts'));
        });

        it('prefers a real, exactly-matching .js file over swapping to .ts when both exist', () => {
            const result = resolveImport({
                fromFile: path.resolve(`${dir}/consumer.ts`),
                specifier: './dual-extension-target.js',
            });

            expect(result).not.toBeNull();
            expect(result!).toContain(path.join('nodenext', 'dual-extension-target.js'));
        });
    });

    it('should resolve index file through alias', () => {
        const fromFile = path.resolve('src/core/scanner/__fixtures__/resolve/ts-import.ts');

        const result = resolveImport({
            fromFile,
            specifier: '@shared/foo',
            tsconfig: {
                baseDir: path.resolve('src/core/scanner/__fixtures__/resolve'),
                baseUrl: '.',
                paths: {
                    '@shared/*': ['shared/*'],
                },
            },
        });

        expect(result).not.toBeNull();
        expect(result!).toContain(path.join('shared', 'foo', 'index.ts'));
    });
});
