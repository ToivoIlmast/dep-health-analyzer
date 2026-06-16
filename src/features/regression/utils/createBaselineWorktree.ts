import { execSync } from 'node:child_process';

export function createBaselineWorktree(baselineRef: string): string {
    const worktreePath = '.dep-health-analyzer';
    try {
        execSync(`git worktree remove "${worktreePath}" --force`, {
            stdio: 'ignore',
        });
    } catch {
        // Worktree may not exist yet.
    }

    execSync('git worktree prune', {
        stdio: 'ignore',
    });

    execSync(`git worktree add --detach "${worktreePath}" "${baselineRef}"`, {
        stdio: 'inherit',
    });

    return worktreePath;
}
