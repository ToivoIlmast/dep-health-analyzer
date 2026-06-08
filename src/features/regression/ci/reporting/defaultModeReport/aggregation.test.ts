import { aggregation } from './aggregation';
import { DependencyInsight } from '../../../types';

describe('aggregation', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const createInsight = (overrides: Partial<DependencyInsight> = {}): DependencyInsight => ({
        from: 'a.ts',
        to: 'b.ts',
        commonDepth: 1,
        residualDepth: 1,
        commonParent: 'app',
        relation: 'cross-boundary',
        severity: 'warning',
        interpretation: 'Cross boundary dependency',
        reasoning: ['reason'],
        ...overrides,
    });

    it('should create finding for single insight', () => {
        const result = aggregation({
            delta: [createInsight()],
        });

        expect(result).toHaveLength(1);

        const finding = result[0]!;

        expect(finding).toMatchObject({
            key: 'cross-boundary:app',
            relation: 'cross-boundary',
            commonParent: 'app',
            count: 1,
        });

        expect(finding.examples).toHaveLength(1);
    });

    it('should group insights by relation and commonParent', () => {
        const result = aggregation({
            delta: [
                createInsight(),
                createInsight({
                    from: 'c.ts',
                    to: 'd.ts',
                }),
            ],
        });

        expect(result).toHaveLength(1);

        const finding = result[0]!;

        expect(finding.count).toBe(2);
        expect(finding.examples).toHaveLength(2);
    });

    it('should create separate findings for different relations', () => {
        const result = aggregation({
            delta: [
                createInsight(),
                createInsight({
                    relation: 'deep-internal',
                    interpretation: 'Deep internal dependency',
                }),
            ],
        });

        expect(result).toHaveLength(2);
    });

    it('should create separate findings for different commonParent values', () => {
        const result = aggregation({
            delta: [
                createInsight(),
                createInsight({
                    commonParent: 'core',
                }),
            ],
        });

        expect(result).toHaveLength(2);
    });

    it('should preserve examples in grouped finding', () => {
        const result = aggregation({
            delta: [
                createInsight({
                    from: 'a.ts',
                }),
                createInsight({
                    from: 'c.ts',
                    to: 'd.ts',
                }),
            ],
        });

        const finding = result[0]!;

        expect(finding.examples.map((e) => e.from)).toEqual(['a.ts', 'c.ts']);
    });
});
