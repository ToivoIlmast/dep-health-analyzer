import { TrendClassification } from './getTrendInsights';

/**
 * Single point of translation from the internal classification id to
 * user-/AI-facing wording. `TrendClassification`'s own values
 * (worsening/stabilizing/volatile/stable) stay as internal identifiers -
 * calibration tests and comments in getTrendInsights.ts already reference
 * them - but nothing outside this module should ever display or transmit
 * them directly, since words like "worsening" assert an architectural
 * judgement ("this is bad") the tool cannot actually make: it only knows
 * that the count of heuristic findings per sampled window went up, down,
 * fluctuated, or showed no clear direction - not whether that reflects a
 * real architectural problem for this specific project.
 *
 * `stable` deliberately does NOT become "Flat": classifyTrend() returns
 * it for three different situations (fewer than 2 real data points -
 * genuinely can't say anything about a trend; both halves of the range
 * are exactly zero; or a low coefficient of variation around a nonzero
 * mean). The first case never observed a flat trend at all - it just
 * doesn't have enough points to measure one - so "Flat" would overclaim
 * what was actually seen. "No Clear Trend" is accurate for all three.
 */
const TREND_LABEL: Record<TrendClassification, string> = {
    worsening: 'Increasing',
    stabilizing: 'Decreasing',
    volatile: 'Fluctuating',
    stable: 'No Clear Trend',
};

export function getTrendLabel(classification: TrendClassification): string {
    return TREND_LABEL[classification];
}
