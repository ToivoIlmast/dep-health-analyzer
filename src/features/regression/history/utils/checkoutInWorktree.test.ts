import { execFileSync } from 'node:child_process';

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));

import { checkoutInWorktree } from './checkoutInWorktree';

const mockedExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;

describe('checkoutInWorktree', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('checks out the given ref detached', () => {
        checkoutInWorktree('/tmp/worktree', 'abc1234');

        expect(mockedExecFileSync).toHaveBeenCalledWith(
            'git',
            ['checkout', '--detach', 'abc1234'],
            expect.anything()
        );
    });

    it('runs the checkout inside the given worktree, not the current working directory', () => {
        checkoutInWorktree('/tmp/worktree', 'abc1234');

        expect(mockedExecFileSync).toHaveBeenCalledWith(
            'git',
            expect.anything(),
            expect.objectContaining({ cwd: '/tmp/worktree' })
        );
    });
});
