import { getCommonDepth } from './getCommonDepth';

describe('getCommonDepth', () => {
    it('should return full common depth for identical paths', () => {
        expect(getCommonDepth('src/features/cycles', 'src/features/cycles')).toBe(3);
    });

    it('should return common depth for nested paths', () => {
        expect(getCommonDepth('src/features/cycles', 'src/features/regression')).toBe(2);
    });

    it('should return zero when paths have no common segments', () => {
        expect(getCommonDepth('src/features', 'tests/unit')).toBe(0);
    });

    it('should support windows path separators', () => {
        expect(getCommonDepth('src\\features\\cycles', 'src\\features\\regression')).toBe(2);
    });

    it('should return depth of shorter path when one path is prefix of another', () => {
        expect(getCommonDepth('src/features', 'src/features/cycles')).toBe(2);
    });
});
