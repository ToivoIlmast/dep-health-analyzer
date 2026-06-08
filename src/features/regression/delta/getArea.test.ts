import { getArea } from './getArea';

describe('getArea', () => {
    it('should return first two segments by default', () => {
        const result = getArea('src/features/regression/utils/createBaselineWorktree.ts');

        expect(result).toBe('src/features');
    });

    it('should respect custom depth', () => {
        const result = getArea('src/features/regression/utils/createBaselineWorktree.ts', 3);

        expect(result).toBe('src/features/regression');
    });

    it('should support windows path separators', () => {
        const result = getArea('src\\features\\regression\\utils\\createBaselineWorktree.ts', 2);

        expect(result).toBe('src/features');
    });

    it('should return full path when depth exceeds number of segments', () => {
        const result = getArea('src/features', 10);

        expect(result).toBe('src/features');
    });
});
