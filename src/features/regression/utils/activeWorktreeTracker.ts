/**
 * Tracks the currently in-flight baseline worktree (if any), so a
 * SIGINT/SIGTERM handler can clean it up if the process is killed mid-run.
 * Only one worktree is ever active at a time in this codebase - regression
 * creates and removes one per run, and history reuses a single worktree
 * across its whole walk - so a single module-level slot is enough; no
 * stack/registry needed.
 */
let activeWorktree: string | null = null;

export function trackWorktree(worktreePath: string): void {
    activeWorktree = worktreePath;
}

export function untrackWorktree(): void {
    activeWorktree = null;
}

export function getActiveWorktree(): string | null {
    return activeWorktree;
}
