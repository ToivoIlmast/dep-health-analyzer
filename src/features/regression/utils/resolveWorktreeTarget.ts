import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Maps a scan target given relative to the current project into the
 * equivalent path inside a git worktree checked out elsewhere on disk.
 */
export function resolveWorktreeTarget(worktree: string, target: string): string {
    const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
        encoding: 'utf8',
    }).trim();

    const currentDir = process.cwd();

    const relativeProjectPath = path.relative(repoRoot, currentDir);

    const normalizedTarget = target.replace(/^\.?\//, '');

    return path.join(worktree, relativeProjectPath, normalizedTarget);
}
