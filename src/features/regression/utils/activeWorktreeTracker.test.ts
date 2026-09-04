import { trackWorktree, untrackWorktree, getActiveWorktree } from './activeWorktreeTracker';

describe('activeWorktreeTracker', () => {
    afterEach(() => {
        untrackWorktree();
    });

    it('returns null when nothing is tracked', () => {
        expect(getActiveWorktree()).toBeNull();
    });

    it('returns the tracked worktree path after trackWorktree', () => {
        trackWorktree('/tmp/some-worktree');

        expect(getActiveWorktree()).toBe('/tmp/some-worktree');
    });

    it('returns null again after untrackWorktree', () => {
        trackWorktree('/tmp/some-worktree');
        untrackWorktree();

        expect(getActiveWorktree()).toBeNull();
    });

    it('overwrites the previously tracked worktree when tracking a new one', () => {
        trackWorktree('/tmp/first');
        trackWorktree('/tmp/second');

        expect(getActiveWorktree()).toBe('/tmp/second');
    });
});
