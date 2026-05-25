import fs from 'node:fs';
import { execSync } from 'node:child_process';

export function removeBaselineWorktree(worktree: string): void {
    try {
        if (fs.existsSync(worktree)) {
            execSync(`git worktree remove ${worktree} --force`, {
                stdio: 'ignore',
            });

            execSync('git worktree prune', {
                stdio: 'ignore',
            });
        }
    } catch (_err) {
        console.error('removeBaselineWorktree', _err);
    }
}
