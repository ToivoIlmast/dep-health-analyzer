import { execFileSync } from 'node:child_process';
import path from 'node:path';

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));

import { resolveWorktreeTarget } from './resolveWorktreeTarget';

const mockedExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;

describe('resolveWorktreeTarget', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('joins the worktree with the project subpath and target', () => {
        mockedExecFileSync.mockReturnValue('/repo\n');
        jest.spyOn(process, 'cwd').mockReturnValue('/repo/packages/app');

        const result = resolveWorktreeTarget('/tmp/worktree', './src');

        expect(result).toBe(path.join('/tmp/worktree', 'packages/app', 'src'));
    });

    it('strips a leading "./" from the target', () => {
        mockedExecFileSync.mockReturnValue('/repo\n');
        jest.spyOn(process, 'cwd').mockReturnValue('/repo');

        const result = resolveWorktreeTarget('/tmp/worktree', './src');

        expect(result).toBe(path.join('/tmp/worktree', '', 'src'));
    });

    it('resolves correctly when the current directory is the repo root', () => {
        mockedExecFileSync.mockReturnValue('/repo\n');
        jest.spyOn(process, 'cwd').mockReturnValue('/repo');

        const result = resolveWorktreeTarget('/tmp/worktree', '.');

        expect(result).toBe(path.join('/tmp/worktree', '.'));
    });
});
