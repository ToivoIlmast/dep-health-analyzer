import { getTrendLabel } from './describeTrend';
import { TrendClassification } from './getTrendInsights';

describe('getTrendLabel', () => {
    it('describes worsening as Increasing (the average findings per window went up)', () => {
        expect(getTrendLabel('worsening')).toBe('Increasing');
    });

    it('describes stabilizing as Decreasing (the average findings per window went down)', () => {
        expect(getTrendLabel('stabilizing')).toBe('Decreasing');
    });

    it('describes volatile as Fluctuating (high variance, no clear direction)', () => {
        expect(getTrendLabel('volatile')).toBe('Fluctuating');
    });

    it('describes stable as "No Clear Trend", not "Flat" - classifyTrend returns it both when the data is genuinely flat AND when there are too few points to measure a trend at all, and only the former was actually observed', () => {
        expect(getTrendLabel('stable')).toBe('No Clear Trend');
    });

    it('has a label for every possible TrendClassification value (exhaustive by construction - TypeScript would fail to compile a missing case)', () => {
        const allClassifications: TrendClassification[] = ['worsening', 'stabilizing', 'volatile', 'stable'];

        for (const classification of allClassifications) {
            expect(typeof getTrendLabel(classification)).toBe('string');
            expect(getTrendLabel(classification).length).toBeGreaterThan(0);
        }
    });

    it('never describes a trend in terms of architecture getting better or worse - an increasing finding count is a change in a heuristic count, not a proven degradation', () => {
        const JUDGEMENT_WORDS = ['worse', 'better', 'bad', 'good', 'risk', 'degrad', 'improv', 'health'];
        const allClassifications: TrendClassification[] = ['worsening', 'stabilizing', 'volatile', 'stable'];

        for (const classification of allClassifications) {
            const label = getTrendLabel(classification).toLowerCase();
            for (const word of JUDGEMENT_WORDS) {
                expect(label).not.toContain(word);
            }
        }
    });
});
