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
});
