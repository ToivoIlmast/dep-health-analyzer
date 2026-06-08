import { execSync } from 'node:child_process';
import { resolveBaselineRef } from './resolveBaselineRef';

jest.mock('node:child_process', () => ({
    execSync: jest.fn(),
}));

describe('resolveBaselineRef', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return provided baseline ref', () => {
        expect(resolveBaselineRef('main')).toBe('main');
    });

    it('should return HEAD~1 when previous commit exists', () => {
        (execSync as jest.Mock).mockImplementation(() => undefined);

        expect(resolveBaselineRef()).toBe('HEAD~1');
    });

    it('should return HEAD when previous commit does not exist', () => {
        (execSync as jest.Mock).mockImplementation(() => {
            throw new Error('git error');
        });

        expect(resolveBaselineRef()).toBe('HEAD');
    });
});
