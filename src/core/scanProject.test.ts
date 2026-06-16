import { scanProject } from './scanProject';

describe('scanProject', () => {
    it('should include scan root in result', async () => {
        const result = await scanProject({
            projectRoot: '/tmp/project',
            scanRoot: '/tmp/project/src',
        });

        expect(result.root).toBe('/tmp/project/src');
    });
});
