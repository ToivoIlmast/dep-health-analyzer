import { execFileSync } from 'node:child_process';
import path from 'node:path';

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));

import { resolveWorktreeTarget } from './resolveWorktreeTarget';

const mockedExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;

describe('resolveWorktreeTarget', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('joins the worktree with the project subpath and target', () => {
        mockedExecFileSync.mockReturnValue('/repo\n');
        jest.spyOn(process, 'cwd').mockReturnValue('/repo/packages/app');

        const result = resolveWorktreeTarget('/tmp/worktree', './src');

        expect(result).toBe(path.join('/tmp/worktree', 'packages/app', 'src'));
    });

    it('strips a leading "./" from the target', () => {
        mockedExecFileSync.mockReturnValue('/repo\n');
        jest.spyOn(process, 'cwd').mockReturnValue('/repo');

        const result = resolveWorktreeTarget('/tmp/worktree', './src');

        expect(result).toBe(path.join('/tmp/worktree', '', 'src'));
    });

    it('resolves correctly when the current directory is the repo root', () => {
        mockedExecFileSync.mockReturnValue('/repo\n');
        jest.spyOn(process, 'cwd').mockReturnValue('/repo');

        const result = resolveWorktreeTarget('/tmp/worktree', '.');

        expect(result).toBe(path.join('/tmp/worktree', '.'));
    });

    // F3 · P1 (AUDIT_v0.11.0.md): `target.replace(/^\.?\//, '')` has no
    // path.isAbsolute() check, so an absolute --target (an ordinary CI
    // idiom, e.g. `--target "$GITHUB_WORKSPACE/src"`) gets string-appended
    // onto the worktree path unchanged, producing a path that never exists
    // - the baseline scan then silently sees 0 files. Recommended fix from
    // the audit: compute path.relative(repoRoot, target) when target is
    // absolute, before joining.
    describe('absolute target (F3)', () => {
        it('maps an absolute target under a nested cwd to the same subpath a relative target would', () => {
            mockedExecFileSync.mockReturnValue('/repo\n');
            jest.spyOn(process, 'cwd').mockReturnValue('/repo/packages/app');

            const result = resolveWorktreeTarget('/tmp/worktree', '/repo/packages/app/src');

            // Must be the exact same result as the already-passing relative
            // case above, not just "some path under worktree" - relative
            // and absolute forms of the SAME real directory must map to
            // the SAME place inside the worktree.
            expect(result).toBe(path.join('/tmp/worktree', 'packages/app', 'src'));
        });

        it('maps an absolute target when cwd is the repo root', () => {
            mockedExecFileSync.mockReturnValue('/repo\n');
            jest.spyOn(process, 'cwd').mockReturnValue('/repo');

            const result = resolveWorktreeTarget('/tmp/worktree', '/repo/src');

            expect(result).toBe(path.join('/tmp/worktree', 'src'));
        });

        it('maps an absolute target that is the repo root itself', () => {
            mockedExecFileSync.mockReturnValue('/repo\n');
            jest.spyOn(process, 'cwd').mockReturnValue('/repo');

            const result = resolveWorktreeTarget('/tmp/worktree', '/repo');

            expect(result).toBe(path.join('/tmp/worktree', '.'));
        });
    });
});
