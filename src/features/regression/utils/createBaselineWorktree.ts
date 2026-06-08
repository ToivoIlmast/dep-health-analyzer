import fs from 'node:fs';
import { execSync } from 'node:child_process';

export function createBaselineWorktree(baselineRef: string): string {
    const worktreePath = '.dep-health-analyzer';
    try {
        if (fs.existsSync(worktreePath)) {
            execSync('git worktree remove .dep-health-analyzer', {
                stdio: 'ignore',
            });
        }
    } catch (_err) {
        console.error('createBaselineWorktree', _err);
    }

    if (fs.existsSync(worktreePath)) {
        execSync('git worktree prune', {
            stdio: 'ignore',
        });
    }

    execSync(`git worktree add .dep-health-analyzer ${baselineRef}`, {
        stdio: 'inherit',
    });

    return '.dep-health-analyzer';
}
