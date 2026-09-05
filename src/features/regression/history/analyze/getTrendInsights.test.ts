import type { HistoryPoint } from '../types';
import { getTrendInsights } from './getTrendInsights';

function makeCommit(sha: string) {
    return { sha, date: '2026-01-01T00:00:00Z', title: `commit ${sha}` };
}

function makePoints(values: Array<number | null>): HistoryPoint[] {
    return values.map((value, i) => ({
        commit: makeCommit(`c${i}`),
        scannedFiles: 10,
        modules: 10,
        incremental: value === null ? null : { findings: Array(value).fill(null).map(() => ({
            from: 'a.ts', to: 'b.ts', commonDepth: 1, residualDepth: 1, commonParent: '',
            relation: 'cross-boundary' as const, severity: 'warning' as const, interpretation: '', reasoning: [],
        })) },
        cumulative: null,
    }));
}

describe('getTrendInsights', () => {
    it('returns stable with no spikes for an all-zero series', () => {
        const insights = getTrendInsights(makePoints([null, 0, 0, 0, 0]));

        expect(insights.classification).toBe('stable');
        expect(insights.spikes).toEqual([]);
        expect(insights.worstWindow).toBeNull();
    });

    it('returns stable when there are fewer than 2 real data points', () => {
        const insights = getTrendInsights(makePoints([null, 5]));

        expect(insights.classification).toBe('stable');
    });

    it('ignores the baseline point (null incremental) when computing values', () => {
        const insights = getTrendInsights(makePoints([null, 0, 0]));

        expect(insights.classification).toBe('stable');
    });

    it('classifies a series that drops off as stabilizing', () => {
        const insights = getTrendInsights(makePoints([null, 20, 20, 20, 1, 1, 1]));

        expect(insights.classification).toBe('stabilizing');
    });

    it('classifies a series that grows as worsening', () => {
        const insights = getTrendInsights(makePoints([null, 1, 1, 1, 20, 20, 20]));

        expect(insights.classification).toBe('worsening');
    });

    it('classifies going from all-zero to nonzero as worsening', () => {
        const insights = getTrendInsights(makePoints([null, 0, 0, 0, 10, 10]));

        expect(insights.classification).toBe('worsening');
    });

    it('flags a value more than 2x the mean and >= the absolute minimum as a spike', () => {
        const insights = getTrendInsights(makePoints([null, 5, 5, 5, 30, 5, 5]));

        expect(insights.spikes).toHaveLength(1);
        expect(insights.spikes[0]?.value).toBe(30);
    });

    it('does not flag a small absolute value as a spike even if it is > 2x a near-zero mean', () => {
        // mean is tiny, so "value 3" is technically > 2x mean, but 3 is
        // below the absolute minimum and shouldn't register as a real spike.
        const insights = getTrendInsights(makePoints([null, 0, 0, 0, 3, 0, 0]));

        expect(insights.spikes).toEqual([]);
    });

    it('identifies the worst window as the single highest-value point', () => {
        const insights = getTrendInsights(makePoints([null, 5, 12, 3, 8]));

        expect(insights.worstWindow?.value).toBe(12);
        expect(insights.worstWindow?.commit.sha).toBe('c2');
    });

    it('reports the correct sha and index for a spike', () => {
        const insights = getTrendInsights(makePoints([null, 1, 1, 40, 1]));

        expect(insights.spikes[0]).toMatchObject({ index: 3, value: 40 });
        expect(insights.spikes[0]?.commit.sha).toBe('c3');
    });

    it('matches real historical data from dep-health\'s own repo (root -> master, 20 sampled points)', () => {
        // Real series collected live via walkHistory against this project's
        // own history, not invented - used to calibrate the thresholds above.
        const realIncremental = [
            null, 14, 0, 86, 27, 0, 30, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 50, 12,
        ];
        const insights = getTrendInsights(makePoints(realIncremental));

        expect(insights.classification).toBe('stabilizing');
        expect(insights.spikes.map((s) => s.value).sort((a, b) => a - b)).toEqual([12, 14, 27, 30, 50, 86]);
        expect(insights.worstWindow?.value).toBe(86);
    });

    it('matches real historical data from a shorter recent window (last 15 commits)', () => {
        const realIncremental = [null, 30, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 50, 12];
        const insights = getTrendInsights(makePoints(realIncremental));

        expect(insights.classification).toBe('worsening');
        expect(insights.spikes.map((s) => s.value).sort((a, b) => a - b)).toEqual([12, 30, 50]);
    });

    it('does not let one huge outlier mask a real secondary spike underneath it', () => {
        // The single 500 pulls the plain mean up to 65 (threshold 130),
        // hiding the three 40s - a real 8x jump over the quiet baseline of
        // 5 - from ever being flagged. Excluding 500 and recomputing on the
        // remainder (mean ~16.7, threshold ~33.3) correctly surfaces them.
        const insights = getTrendInsights(makePoints([null, 500, 40, 40, 40, 5, 5, 5, 5, 5, 5]));

        expect(insights.spikes.map((s) => s.value).sort((a, b) => a - b)).toEqual([40, 40, 40, 500]);
        expect(insights.worstWindow?.value).toBe(500);
    });

    it('stops excluding outliers once the remaining values are quiet, without over-flagging a single spike in an otherwise flat series', () => {
        const insights = getTrendInsights(makePoints([null, 0, 0, 0, 0, 0, 0, 0, 50]));

        expect(insights.spikes).toHaveLength(1);
        expect(insights.spikes[0]?.value).toBe(50);
    });

    it('does not consume most of a smoothly/geometrically growing series as spikes', () => {
        // A doubling series never produces a "quiet remainder" - excluding
        // the top value still leaves a series with the same shape, so an
        // uncapped outlier-exclusion loop would keep re-triggering on the
        // new top value and flag most of the series (verified separately:
        // 12 of 15 points, before the two-pass cap). Two passes limits this
        // to the two highest points, which is also what a real steadily-
        // worsening (not spiky) history should surface as "worst window"
        // material, not a dozen separate "spikes".
        const doubling = Array.from({ length: 15 }, (_, i) => 5 * 2 ** i);
        const insights = getTrendInsights(makePoints([null, ...doubling]));

        expect(insights.spikes.length).toBeLessThanOrEqual(4);
        expect(insights.spikes.map((s) => s.value)).toEqual([10240, 20480, 40960, 81920]);
    });

    it('returns spikes in chronological order even when a later pass finds an earlier point', () => {
        // 500 (last) is found in pass 1, pulling the mean up; 40 (earlier,
        // at index 5) is only found in pass 2 once 500 is excluded. The
        // result should still read in commit order (40 before 500), not
        // insertion order (500 before 40).
        const insights = getTrendInsights(makePoints([null, 5, 5, 5, 5, 40, 500]));

        expect(insights.spikes.map((s) => s.value)).toEqual([40, 500]);
    });
});
