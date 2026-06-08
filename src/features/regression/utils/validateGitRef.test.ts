import { execSync } from 'node:child_process';
import { validateGitRef } from './validateGitRef';

jest.mock('node:child_process', () => ({
    execSync: jest.fn(),
}));

describe('validateGitRef', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return true when git ref is valid', () => {
        (execSync as jest.Mock).mockImplementation(() => undefined);

        const result = validateGitRef('HEAD');

        expect(result).toBe(true);
    });

    it('should return false when git ref is invalid', () => {
        (execSync as jest.Mock).mockImplementation(() => {
            throw new Error('git error');
        });

        const result = validateGitRef('invalid-ref');

        expect(result).toBe(false);
    });

    it('should call git rev-parse with provided ref', () => {
        (execSync as jest.Mock).mockImplementation(() => undefined);

        validateGitRef('HEAD~3');

        expect(execSync).toHaveBeenCalledWith('git rev-parse --verify HEAD~3', {
            stdio: 'ignore',
        });
    });
});
