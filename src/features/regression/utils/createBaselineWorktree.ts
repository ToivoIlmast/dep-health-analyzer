import { execFileSync } from 'node:child_process';

export function createBaselineWorktree(baselineRef: string): string {
    const worktreePath = '.dep-health-analyzer';
    try {
        execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
            stdio: 'ignore',
        });
    } catch {
        // Worktree may not exist yet.
    }

    execFileSync('git', ['worktree', 'prune'], {
        stdio: 'ignore',
    });

    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, baselineRef], {
        stdio: 'inherit',
    });

    return worktreePath;
}
