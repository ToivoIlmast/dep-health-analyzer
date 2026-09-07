import { ciModeReport } from './ciModeReport';
import { DependencyInsight } from '@features/regression/types';

describe('ciModeReport', () => {
    const createInsight = (relation: DependencyInsight['relation']): DependencyInsight => ({
        from: 'a.ts',
        to: 'b.ts',
        commonDepth: 1,
        residualDepth: 1,
        commonParent: 'src',
        relation,
        severity: 'warning',
        interpretation: 'test',
        reasoning: ['test'],
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should report that cross-boundary or deep-internal findings were introduced', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        ciModeReport({
            delta: [createInsight('cross-boundary')],
        });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('Cross-boundary or deep-internal findings were introduced')
        );
    });

    it('should report that no cross-boundary or deep-internal findings were introduced', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        ciModeReport({
            delta: [],
        });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('No cross-boundary or deep-internal findings were introduced')
        );
    });
});
