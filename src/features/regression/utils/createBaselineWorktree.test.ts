import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { createBaselineWorktree } from './createBaselineWorktree';

jest.mock('node:child_process', () => ({
    execFileSync: jest.fn(),
}));

describe('createBaselineWorktree', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should create the worktree under the OS temp directory', () => {
        (execFileSync as jest.Mock).mockImplementation(() => undefined);

        const worktreePath = createBaselineWorktree('HEAD~1');

        expect(worktreePath.startsWith(os.tmpdir())).toBe(true);
    });

    it('should return a different path on every call, avoiding collisions between concurrent runs', () => {
        (execFileSync as jest.Mock).mockImplementation(() => undefined);

        const first = createBaselineWorktree('HEAD~1');
        const second = createBaselineWorktree('HEAD~1');

        expect(first).not.toBe(second);
    });

    it('should only add the worktree, without removing any pre-existing path first', () => {
        (execFileSync as jest.Mock).mockImplementation(() => undefined);

        createBaselineWorktree('HEAD~1');

        expect(execFileSync).toHaveBeenCalledTimes(1);
        expect(execFileSync).toHaveBeenCalledWith(
            'git',
            ['worktree', 'add', '--detach', expect.stringContaining(os.tmpdir()), 'HEAD~1'],
            { stdio: 'inherit' }
        );
    });
});
