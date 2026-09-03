import { getRiskLevel } from './template';

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
