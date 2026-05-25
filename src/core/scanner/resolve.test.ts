import path from 'node:path';
import { resolveImport } from './resolve';

describe('resolveImport', () => {
    it.each([
        ['ts-import.ts', './a1', 'a1.ts'],
        ['tsx-import.tsx', './a2', 'a2.tsx'],
        ['js-import.js', './a3', 'a3.js'],
        ['jsx-import.jsx', './a4', 'a4.jsx'],
    ])('should resolve %s import', (fromFile, specifier, expected) => {
        const result = resolveImport(
            path.resolve(`src/core/scanner/__fixtures__/resolve/${fromFile}`),
            specifier
        );

        expect(result).not.toBeNull();
        expect(result!).toContain(expected);
    });

    it('should resolve index.ts file', () => {
        const fromFile = path.resolve(
            'src/core/scanner/__fixtures__/resolve/ts-index/index-import.ts'
        );

        const result = resolveImport(fromFile, './a5');

        expect(result).not.toBeNull();
        expect(result!).toContain('a5/index.ts');
    });

    it('should return null for external package import', () => {
        const fromFile = path.resolve(
            'src/core/scanner/__fixtures__/resolve/external-package-import.ts'
        );

        const result = resolveImport(fromFile, 'node:path');

        expect(result).toBeNull();
    });

    it('should return null when file does not exist', () => {
        const tsImports = 'src/core/scanner/__fixtures__/resolve/ts-import.ts';
        const result = resolveImport(path.resolve(tsImports), './b');

        expect(result).toBeNull();
    });

    // TODO:
    /*
    it('should normalize returned path');

    it('should resolve nested relative import');

    it('should prefer direct file over index file');

    it('should skip alias imports');

    it('should resolve import from sibling directory'); 
    */
});
