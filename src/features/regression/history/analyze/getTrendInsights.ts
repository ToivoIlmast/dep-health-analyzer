import { HistoryCommit } from '../utils/getCommitHistory';
import { HistoryPoint } from '../types';

/**
 * A spike must be at least this many times the series' own mean...
 */
const SPIKE_RATIO_THRESHOLD = 2;
/**
 * ...AND at least this many absolute findings, so a quiet series (mean
 * close to 0) doesn't flag a trivial value (e.g. 2 findings) as a "spike"
 * just because it's technically more than double an almost-zero mean.
 * Calibrated against dep-health's own real history: a 19-point incremental
 * series with values [14,0,86,27,0,30,0,0,1,1,0,1,0,1,0,0,0,50,12] (mean
 * ~11.8) correctly flags 86, 27, 30, 50, 14, 12 (in outlier-exclusion
 * passes, see findSpikeIndices) as the genuinely elevated windows - not the
 * many near-zero ones.
 */
const MIN_SPIKE_ABSOLUTE = 5;
/** A >=30% drop between the first and second half counts as "stabilizing". */
const TREND_SHRINK_RATIO = 0.7;
/** A >=30% rise between the first and second half counts as "worsening". */
const TREND_GROWTH_RATIO = 1.3;
/** Coefficient of variation (stddev/mean) above this counts as "volatile". */
const VOLATILITY_CV_THRESHOLD = 1;

export type TrendPoint = {
    index: number;
    commit: HistoryCommit;
    value: number;
};

export type TrendClassification = 'stabilizing' | 'worsening' | 'volatile' | 'stable';

export type TrendInsights = {
    classification: TrendClassification;
    spikes: TrendPoint[];
    worstWindow: TrendPoint | null;
};

function mean(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], average: number): number {
    if (values.length === 0) {
        return 0;
    }
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

function classifyTrend(values: number[], average: number): TrendClassification {
    if (values.length < 2) {
        return 'stable';
    }

    const midpoint = Math.ceil(values.length / 2);
    const firstAvg = mean(values.slice(0, midpoint));
    const secondAvg = mean(values.slice(midpoint));

    if (firstAvg === 0 && secondAvg === 0) {
        return 'stable';
    }

    if (firstAvg === 0) {
        return 'worsening';
    }

    if (secondAvg <= firstAvg * TREND_SHRINK_RATIO) {
        return 'stabilizing';
    }

    if (secondAvg >= firstAvg * TREND_GROWTH_RATIO) {
        return 'worsening';
    }

    const cv = average > 0 ? standardDeviation(values, average) / average : 0;
    return cv > VOLATILITY_CV_THRESHOLD ? 'volatile' : 'stable';
}

/**
 * At most this many outlier-exclusion passes (see findSpikeIndices) run
 * before stopping, even if a pass still finds something. Without a cap, a
 * smoothly/geometrically growing series (e.g. findings doubling each
 * sampled point) never produces a "quiet remainder" to stop the loop -
 * removing the top value still leaves a series with the same shape, so
 * each pass just re-triggers on the new top value, consuming most of the
 * series from the top down (verified: an uncapped loop flags 12 of 15
 * points on a pure doubling series). Two passes is exactly enough for the
 * motivating case - one very large outlier masking a smaller secondary
 * spike underneath it - without drilling further into what, for a
 * continuously growing series, is really one continuous trend rather
 * than discrete anomalies.
 */
const MAX_OUTLIER_EXCLUSION_PASSES = 2;

/**
 * Finds every point that's a spike relative to the *rest* of the series,
 * not just relative to the raw overall mean. A single very large outlier
 * pulls the plain mean up enough to hide a real secondary spike sitting
 * underneath it (e.g. [500, 40,40,40, 5,5,5,5,5,5] - the mean of 65 masks
 * the 40s, which are a real 8x jump over the quiet baseline of 5).
 * Finds spikes against the current mean, removes them, and repeats
 * against the remaining values (up to MAX_OUTLIER_EXCLUSION_PASSES times)
 * - so each pass's mean reflects only the points not already explained by
 * a bigger spike.
 */
function findSpikeIndices(values: number[]): Set<number> {
    const spikeIndices = new Set<number>();
    let remainingIndices = values.map((_, index) => index);

    for (let pass = 0; pass < MAX_OUTLIER_EXCLUSION_PASSES; pass++) {
        const remainingValues = remainingIndices.map((index) => values[index] as number);
        const average = mean(remainingValues);

        if (average <= 0) {
            break;
        }

        const newSpikeIndices = remainingIndices.filter((index) => {
            const value = values[index] as number;
            return value > average * SPIKE_RATIO_THRESHOLD && value >= MIN_SPIKE_ABSOLUTE;
        });

        if (newSpikeIndices.length === 0) {
            break;
        }

        newSpikeIndices.forEach((index) => spikeIndices.add(index));
        remainingIndices = remainingIndices.filter((index) => !spikeIndices.has(index));
    }

    return spikeIndices;
}

/**
 * Derives interpretive signal from a history walk's incremental series
 * (risk introduced per sampled window) - always the incremental series
 * specifically, regardless of which strategy the user picked for display,
 * since it's always present in HistoryPoint data and "spike"/"trend" only
 * make sense per-window, not for the running cumulative total.
 */
export function getTrendInsights(points: HistoryPoint[]): TrendInsights {
    const withIncremental = points
        .map((point, index) => ({ point, index }))
        .filter(
            (
                entry
            ): entry is { point: HistoryPoint & { incremental: NonNullable<HistoryPoint['incremental']> }; index: number } =>
                entry.point.incremental !== null
        );

    const values = withIncremental.map((entry) => entry.point.incremental.findings.length);
    const average = mean(values);

    const spikeIndices = findSpikeIndices(values);
    const spikes: TrendPoint[] = withIncremental
        .map((entry, i) => ({ index: entry.index, commit: entry.point.commit, value: values[i] as number, i }))
        .filter(({ i }) => spikeIndices.has(i))
        .map(({ index, commit, value }) => ({ index, commit, value }));

    let worstWindow: TrendPoint | null = null;
    let worstValue = 0;

    withIncremental.forEach((entry, i) => {
        const value = values[i] as number;

        if (value > worstValue) {
            worstValue = value;
            worstWindow = { index: entry.index, commit: entry.point.commit, value };
        }
    });

    return {
        classification: classifyTrend(values, average),
        spikes,
        worstWindow,
    };
}
