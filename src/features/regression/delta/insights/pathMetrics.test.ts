import { getCommonDepth, getCommonParent, getResidualDepth } from './pathMetrics';

describe('pathMetrics', () => {
    describe('getCommonDepth', () => {
        it('should return full common depth for identical paths', () => {
            const result = getCommonDepth('src/features/cycles', 'src/features/cycles');

            expect(result).toBe(3);
        });

        it('should return common depth for nested paths', () => {
            const result = getCommonDepth('src/features/cycles', 'src/features/regression');

            expect(result).toBe(2);
        });

        it('should support windows path separators', () => {
            const result = getCommonDepth('src\\features\\cycles', 'src\\features\\regression');

            expect(result).toBe(2);
        });
    });

    describe('getCommonParent', () => {
        it('should return common parent path', () => {
            const result = getCommonParent('src/features/cycles/a.ts', 'src/features/cycles/b.ts');

            expect(result).toBe('src/features/cycles');
        });

        it('should return empty string when paths have no common parent', () => {
            const result = getCommonParent('src/a.ts', 'tests/b.ts');

            expect(result).toBe('');
        });
    });

    describe('getResidualDepth', () => {
        it('should return residual depth for nested dependency', () => {
            const result = getResidualDepth(
                'src/features/auth/index.ts',
                'src/features/auth/utils/helpers/date.ts',
                3
            );

            expect(result).toBe(2);
        });

        it('should never return negative value', () => {
            const result = getResidualDepth('src/a.ts', 'src/b.ts', 10);
            expect(result).toBe(0);
        });
    });
});
