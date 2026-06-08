import path from 'node:path';
import { extractImports } from './extract';

describe('extractImports', () => {
    it('should extract import declarations', () => {
        const imports = 'src/core/scanner/__fixtures__/extract/imports.ts';
        const result = extractImports(path.resolve(imports));

        expect(result).toEqual(['./a', 'node:fs']);
    });

    it('should extract export declarations', () => {
        const exports = 'src/core/scanner/__fixtures__/extract/exports.ts';
        const result = extractImports(path.resolve(exports));

        expect(result).toEqual(['./imports']);
    });

    it('should return both imports and exports', () => {
        const importsExports = 'src/core/scanner/__fixtures__/extract/imports-exports.ts';
        const result = extractImports(path.resolve(importsExports));

        expect(result).toEqual(['./a', 'node:fs', './imports']);
    });

    it('should return empty array when file has no imports', () => {
        const noImportsAndExports =
            'src/core/scanner/__fixtures__/extract/no-imports-and-exports.ts';
        const result = extractImports(path.resolve(noImportsAndExports));

        expect(result).toEqual([]);
    });

    // TODO:
    /*
    it('should ignore exports without module specifier');

    it('should support multiple imports');

    it('should reuse already loaded source file');

    it('should extract relative imports');

    it('should extract package imports');
    */
});
