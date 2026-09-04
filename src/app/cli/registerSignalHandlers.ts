import { getActiveWorktree } from '@features/regression/utils/activeWorktreeTracker';
import { removeBaselineWorktree } from '@features/regression/utils/removeBaselineWorktree';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Conventional shell exit codes: 128 + signal number.
const SIGNAL_EXIT_CODES: Record<string, number> = {
    SIGINT: 130,
    SIGTERM: 143,
};

function handleSignal(signal: 'SIGINT' | 'SIGTERM'): void {
    const worktree = getActiveWorktree();

    if (worktree) {
        console.error(`${YELLOW}\nInterrupted - cleaning up temporary worktree...\n${RESET}`);
        removeBaselineWorktree(worktree);
    }

    process.exit(SIGNAL_EXIT_CODES[signal]);
}

/**
 * regression/history create a temporary git worktree and rely on try/finally
 * to remove it - which never runs if the process is killed (Ctrl+C) while a
 * scan is in flight. This registers handlers that clean up the worktree
 * currently tracked by activeWorktreeTracker before the process actually
 * exits.
 */
export function registerSignalHandlers(): void {
    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
}
