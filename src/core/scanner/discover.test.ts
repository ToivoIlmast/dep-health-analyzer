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
});
