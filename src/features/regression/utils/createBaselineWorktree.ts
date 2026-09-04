import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { trackWorktree } from './activeWorktreeTracker';

export function createBaselineWorktree(baselineRef: string): string {
    const worktreePath = path.join(os.tmpdir(), `dep-health-analyzer-${crypto.randomUUID()}`);

    execFileSync('git', ['worktree', 'add', '--detach', worktreePath, baselineRef], {
        stdio: 'inherit',
    });

    trackWorktree(worktreePath);

    return worktreePath;
}
