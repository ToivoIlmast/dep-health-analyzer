import type { TrendInsights } from '../analyze/getTrendInsights';
import { buildHistoryPromptData } from './buildHistoryPromptData';

function makeCommit(sha: string) {
    return { sha, date: '2026-01-01T00:00:00Z', title: `commit ${sha}` };
}

describe('buildHistoryPromptData', () => {
    it('always includes trendClassification and sampledPointCount', () => {
        const insights: TrendInsights = { classification: 'stable', spikes: [], worstWindow: null };

        const result = buildHistoryPromptData({ insights, pointCount: 10 });

        expect(result.observations.trendClassification).toBe('stable');
        expect(result.observations.sampledPointCount).toBe(10);
    });

    it('omits worstWindow when there is none', () => {
        const insights: TrendInsights = { classification: 'stable', spikes: [], worstWindow: null };

        const result = buildHistoryPromptData({ insights, pointCount: 5 });

        expect(result.observations.worstWindow).toBeUndefined();
    });

    it('includes a truncated commit sha and date for worstWindow', () => {
        const insights: TrendInsights = {
            classification: 'worsening',
            spikes: [],
            worstWindow: { index: 3, commit: makeCommit('abcdef1234567'), value: 42 },
        };

        const result = buildHistoryPromptData({ insights, pointCount: 8 });

        expect(result.observations.worstWindow).toEqual({
            commit: 'abcdef1',
            date: '2026-01-01',
            findingCount: 42,
        });
    });

    it('omits spikes when there are none', () => {
        const insights: TrendInsights = { classification: 'stable', spikes: [], worstWindow: null };

        const result = buildHistoryPromptData({ insights, pointCount: 5 });

        expect(result.observations.spikes).toBeUndefined();
    });

    it('includes every spike with truncated sha, date, and finding count', () => {
        const insights: TrendInsights = {
            classification: 'volatile',
            spikes: [
                { index: 1, commit: makeCommit('sha1111111'), value: 30 },
                { index: 4, commit: makeCommit('sha2222222'), value: 50 },
            ],
            worstWindow: { index: 4, commit: makeCommit('sha2222222'), value: 50 },
        };

        const result = buildHistoryPromptData({ insights, pointCount: 10 });

        expect(result.observations.spikes).toEqual([
            { commit: 'sha1111', date: '2026-01-01', findingCount: 30 },
            { commit: 'sha2222', date: '2026-01-01', findingCount: 50 },
        ]);
    });

    it('caps spikes at ten, keeping the ten highest by finding count', () => {
        const insights: TrendInsights = {
            classification: 'volatile',
            spikes: Array.from({ length: 15 }, (_, index) => ({
                index,
                commit: makeCommit(`sha${index}`),
                value: index + 1,
            })),
            worstWindow: null,
        };

        const result = buildHistoryPromptData({ insights, pointCount: 15 });

        expect(result.observations.spikes).toHaveLength(10);
        expect(result.observations.spikes?.[0]).toEqual({
            commit: 'sha5',
            date: '2026-01-01',
            findingCount: 6,
        });
        expect(result.observations.spikes?.[9]).toEqual({
            commit: 'sha14',
            date: '2026-01-01',
            findingCount: 15,
        });
    });
});
