import { buildRegressionHtmlTemplate, getRiskLevel } from './template';
import type { DependencyInsight } from '../types';

describe('getRiskLevel', () => {
    it('should return Low when there are no findings at all', () => {
        expect(getRiskLevel({ crossBoundaryCount: 0, totalFindings: 0 })).toBe(
            'Low Architectural Risk'
        );
    });

    it('should return Low when the cross-boundary share is at or below 5%', () => {
        expect(getRiskLevel({ crossBoundaryCount: 5, totalFindings: 100 })).toBe(
            'Low Architectural Risk'
        );
    });

    it('should return Moderate when the cross-boundary share is above 5% and at or below 15%', () => {
        expect(getRiskLevel({ crossBoundaryCount: 6, totalFindings: 100 })).toBe(
            'Moderate Architectural Risk'
        );
        expect(getRiskLevel({ crossBoundaryCount: 15, totalFindings: 100 })).toBe(
            'Moderate Architectural Risk'
        );
    });

    it('should return High when the cross-boundary share is above 15%', () => {
        expect(getRiskLevel({ crossBoundaryCount: 16, totalFindings: 100 })).toBe(
            'High Architectural Risk'
        );
    });

    it('should reproduce the real dep-health self-analysis case that motivated this fix', () => {
        // Previously this compared 4 cross-boundary findings against the whole
        // project's module count (93) -> ~4.3% -> "Low", even though those 4
        // findings were actually ~15.4% of that run's 26 total findings.
        const previouslyMisleadingResult = getRiskLevel({
            crossBoundaryCount: 4,
            totalFindings: 26,
        });

        expect(previouslyMisleadingResult).not.toBe('Low Architectural Risk');
        expect(previouslyMisleadingResult).toBe('High Architectural Risk');
    });

    describe('minimum cross-boundary count before percentage applies', () => {
        // Verified against dep-health's own commit history: every change with
        // exactly 1 cross-boundary finding landed at 33-100% (pure noise from
        // a tiny denominator), while changes with several cross-boundary
        // findings landed at a much more stable 15-45%.

        it('should stay Low with a single cross-boundary finding, no matter how small the change', () => {
            // real case: 1 cross-boundary out of 1 total finding -> 100%
            expect(getRiskLevel({ crossBoundaryCount: 1, totalFindings: 1 })).toBe(
                'Low Architectural Risk'
            );

            // real case: 1 cross-boundary out of 3 total findings -> 33%
            expect(getRiskLevel({ crossBoundaryCount: 1, totalFindings: 3 })).toBe(
                'Low Architectural Risk'
            );
        });

        it('should let percentage apply once there are at least 2 cross-boundary findings', () => {
            // real case: 9 cross-boundary out of 20 total findings -> 45%
            expect(getRiskLevel({ crossBoundaryCount: 9, totalFindings: 20 })).toBe(
                'High Architectural Risk'
            );

            expect(getRiskLevel({ crossBoundaryCount: 2, totalFindings: 100 })).toBe(
                'Low Architectural Risk'
            );
        });
    });
});

describe('buildRegressionHtmlTemplate HTML escaping', () => {
    function makeFinding(overrides: Partial<DependencyInsight> = {}): DependencyInsight {
        return {
            from: 'src/a.ts',
            to: 'src/b.ts',
            commonDepth: 1,
            residualDepth: 1,
            commonParent: 'src',
            relation: 'cross-boundary',
            severity: 'warning',
            interpretation: 'possible cross-boundary dependency',
            reasoning: [],
            ...overrides,
        };
    }

    it('escapes an HTML-breaking file path in the findings table', () => {
        const html = buildRegressionHtmlTemplate({
            delta: [makeFinding({ from: '<script>alert(1)</script>.ts' })],
            target: '.',
            baselineRef: 'HEAD~1',
            currentScannedFiles: 1,
            baselineScannedFiles: 1,
        });

        expect(html).not.toContain('<script>alert(1)</script>.ts');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;.ts');
    });

    it('escapes an HTML-breaking commonParent in the most-affected-area callouts', () => {
        const html = buildRegressionHtmlTemplate({
            delta: [
                makeFinding({
                    from: '<img src=x onerror=alert(2)>/a.ts',
                    commonParent: '<img src=x onerror=alert(2)>',
                }),
            ],
            target: '.',
            baselineRef: 'HEAD~1',
            currentScannedFiles: 1,
            baselineScannedFiles: 1,
        });

        expect(html).not.toContain('<img src=x onerror=alert(2)>');
    });

    it('escapes an HTML-breaking target/baseline ref', () => {
        const html = buildRegressionHtmlTemplate({
            delta: [],
            target: '<script>alert(3)</script>',
            baselineRef: '<script>alert(4)</script>',
            currentScannedFiles: 1,
            baselineScannedFiles: 1,
        });

        expect(html).not.toContain('<script>alert(3)</script>');
        expect(html).not.toContain('<script>alert(4)</script>');
    });
});
