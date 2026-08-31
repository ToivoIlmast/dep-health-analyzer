import { execFileSync } from 'node:child_process';
import { validateGitRef } from './validateGitRef';

jest.mock('node:child_process', () => ({
    execFileSync: jest.fn(),
}));

describe('validateGitRef', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return true when git ref is valid', () => {
        (execFileSync as jest.Mock).mockImplementation(() => undefined);

        const result = validateGitRef('HEAD');

        expect(result).toBe(true);
    });

    it('should return false when git ref is invalid', () => {
        (execFileSync as jest.Mock).mockImplementation(() => {
            throw new Error('git error');
        });

        const result = validateGitRef('invalid-ref');

        expect(result).toBe(false);
    });

    it('should pass the ref as a Git argument instead of interpolating a shell command', () => {
        (execFileSync as jest.Mock).mockImplementation(() => undefined);

        validateGitRef('HEAD~3');

        expect(execFileSync).toHaveBeenCalledWith(
            'git',
            ['rev-parse', '--verify', 'HEAD~3'],
            { stdio: 'ignore' }
        );
    });

    it('should pass shell metacharacters as a literal Git argument', () => {
        (execFileSync as jest.Mock).mockImplementation(() => {
            throw new Error('invalid git ref');
        });

        const result = validateGitRef('HEAD; echo vulnerable');

        expect(result).toBe(false);
        expect(execFileSync).toHaveBeenCalledWith(
            'git',
            ['rev-parse', '--verify', 'HEAD; echo vulnerable'],
            { stdio: 'ignore' }
        );
    });

    it('should reject refs beginning with a dash before invoking Git', () => {
        const result = validateGitRef('--config=core.fsmonitor=true');

        expect(result).toBe(false);
        expect(execFileSync).not.toHaveBeenCalled();
    });
});
