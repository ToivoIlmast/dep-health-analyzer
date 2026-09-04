import { DependencyInsight } from '../types';
import { shouldFail } from './shouldFail';

function makeFinding(severity: 'info' | 'warning' | 'error'): DependencyInsight {
    return {
        from: 'a.ts',
        to: 'b.ts',
        commonDepth: 1,
        residualDepth: 1,
        commonParent: '',
        relation: 'cross-boundary',
        severity,
        interpretation: '',
        reasoning: [],
    };
}

describe('shouldFail', () => {
    it('returns false when there are no findings', () => {
        expect(shouldFail({ findings: [], failOn: 'info' })).toBe(false);
    });

    it('returns false when every finding is below the failOn severity', () => {
        expect(
            shouldFail({ findings: [makeFinding('info')], failOn: 'warning' })
        ).toBe(false);
    });

    it('returns true when a finding matches the failOn severity exactly', () => {
        expect(
            shouldFail({ findings: [makeFinding('warning')], failOn: 'warning' })
        ).toBe(true);
    });

    it('returns true when a finding exceeds the failOn severity', () => {
        expect(
            shouldFail({ findings: [makeFinding('error')], failOn: 'warning' })
        ).toBe(true);
    });

    it('returns true if any finding in a mixed list meets the threshold', () => {
        expect(
            shouldFail({
                findings: [makeFinding('info'), makeFinding('error')],
                failOn: 'error',
            })
        ).toBe(true);
    });
});
