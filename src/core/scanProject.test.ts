import { scanProject } from './scanProject';

describe('scanProject', () => {
    it('should include scan root in result', async () => {
        const result = await scanProject('/tmp/project/src');

        expect(result.root).toBe('/tmp/project/src');
    });
});
