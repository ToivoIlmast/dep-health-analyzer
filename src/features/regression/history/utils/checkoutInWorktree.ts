import { execFileSync } from 'node:child_process';

/**
 * Switches an already-created worktree to a different commit in place.
 *
 * Walking history means visiting many sampled commits in sequence. Creating
 * and removing a fresh `git worktree` per commit (as the single-baseline
 * regression flow does) would re-checkout the whole tree every time, which
 * is expensive over dozens of points. Reusing one worktree and repeatedly
 * checking out inside it is far cheaper.
 */
export function checkoutInWorktree(worktreePath: string, ref: string): void {
    execFileSync('git', ['checkout', '--detach', ref], {
        cwd: worktreePath,
        stdio: 'inherit',
    });
}
