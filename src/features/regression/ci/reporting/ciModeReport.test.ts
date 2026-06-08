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

    it('should report architectural regression', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        ciModeReport({
            delta: [createInsight('cross-boundary')],
        });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('Architectural regression detected')
        );
    });

    it('should report no significant architectural regression', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        ciModeReport({
            delta: [],
        });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('No significant architectural regression detected')
        );
    });
});
