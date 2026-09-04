import { HistoryCommit } from './getCommitHistory';

/**
 * Evenly samples `sampleSize` commits out of an ordered commit chain,
 * always keeping the first and last entries so the trend always covers
 * the full requested range instead of drifting inward.
 */
export function sampleCommits(commits: HistoryCommit[], sampleSize: number): HistoryCommit[] {
    if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
        throw new Error('sampleSize must be a positive integer');
    }

    if (commits.length <= sampleSize) {
        return commits;
    }

    if (sampleSize === 1) {
        // commits.length > sampleSize (1) was just ruled out above, so this index is in bounds.
        return [commits[commits.length - 1] as HistoryCommit];
    }

    const lastIndex = commits.length - 1;
    const sampled: HistoryCommit[] = [];

    for (let i = 0; i < sampleSize; i++) {
        const index = Math.round((i * lastIndex) / (sampleSize - 1));
        // index is always within [0, lastIndex] for i in [0, sampleSize - 1].
        sampled.push(commits[index] as HistoryCommit);
    }

    return sampled.filter((commit, i) => i === 0 || commit.sha !== (sampled[i - 1] as HistoryCommit).sha);
}
