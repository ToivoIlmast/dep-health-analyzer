import { HistoryCommit } from './getCommitHistory';
import { sampleCommits } from './sampleCommits';

function makeCommits(count: number): HistoryCommit[] {
    return Array.from({ length: count }, (_, i) => ({
        sha: `c${i}`,
        date: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        title: `commit ${i}`,
    }));
}

describe('sampleCommits', () => {
    it('returns all commits unchanged when there are fewer than sampleSize', () => {
        const commits = makeCommits(3);

        expect(sampleCommits(commits, 10)).toEqual(commits);
    });

    it('returns all commits unchanged when there are exactly sampleSize', () => {
        const commits = makeCommits(5);

        expect(sampleCommits(commits, 5)).toEqual(commits);
    });

    it('always includes the first and last commit', () => {
        const commits = makeCommits(100);

        const sampled = sampleCommits(commits, 10);

        expect(sampled[0]).toEqual(commits[0]);
        expect(sampled[sampled.length - 1]).toEqual(commits[99]);
    });

    it('spaces sampled points evenly across the range', () => {
        const commits = makeCommits(11);

        const sampled = sampleCommits(commits, 3);

        expect(sampled.map((c) => c.sha)).toEqual(['c0', 'c5', 'c10']);
    });

    it('returns only the last commit when sampleSize is 1', () => {
        const commits = makeCommits(10);

        expect(sampleCommits(commits, 1)).toEqual([commits[9]]);
    });

    it('deduplicates points that round to the same index on a small range', () => {
        const commits = makeCommits(4);

        const sampled = sampleCommits(commits, 3);

        const shas = sampled.map((c) => c.sha);
        expect(new Set(shas).size).toBe(shas.length);
        expect(shas[0]).toBe('c0');
        expect(shas[shas.length - 1]).toBe('c3');
    });

    it('throws for a non-positive sampleSize', () => {
        const commits = makeCommits(5);

        expect(() => sampleCommits(commits, 0)).toThrow('sampleSize must be a positive integer');
        expect(() => sampleCommits(commits, -1)).toThrow('sampleSize must be a positive integer');
    });

    it('throws for a non-integer sampleSize', () => {
        const commits = makeCommits(5);

        expect(() => sampleCommits(commits, 2.5)).toThrow('sampleSize must be a positive integer');
    });
});
