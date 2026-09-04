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
 * ~11.8) correctly flags only 86, 27, 30, 50 - the genuinely elevated
 * windows - not the many near-zero ones.
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

    const spikes: TrendPoint[] = [];
    let worstWindow: TrendPoint | null = null;
    let worstValue = 0;

    withIncremental.forEach((entry, i) => {
        const value = values[i] as number;

        if (average > 0 && value > average * SPIKE_RATIO_THRESHOLD && value >= MIN_SPIKE_ABSOLUTE) {
            spikes.push({ index: entry.index, commit: entry.point.commit, value });
        }

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
