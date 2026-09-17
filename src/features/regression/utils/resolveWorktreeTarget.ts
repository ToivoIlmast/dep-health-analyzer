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

    // F3 (AUDIT_v0.11.0.md): an absolute target is already a real path
    // inside THIS repo (e.g. `--target "$GITHUB_WORKSPACE/src"`, an
    // ordinary CI idiom) - re-anchoring it onto the worktree the same way a
    // relative target is re-anchored onto `currentDir` below would produce
    // a nonexistent path (the old code just stripped a leading "/" and
    // string-concatenated it, silently scanning 0 files). Its equivalent
    // inside the worktree is its own path relative to repoRoot.
    if (path.isAbsolute(target)) {
        const relativeTarget = path.relative(repoRoot, target);

        return path.join(worktree, relativeTarget);
    }

    const currentDir = process.cwd();

    const relativeProjectPath = path.relative(repoRoot, currentDir);

    const normalizedTarget = target.replace(/^\.?\//, '');

    return path.join(worktree, relativeProjectPath, normalizedTarget);
}
