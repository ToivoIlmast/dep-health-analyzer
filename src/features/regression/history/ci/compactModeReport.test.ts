import { HISTORY_STRATEGIES } from '@shared/types';
import type { HistoryPoint } from '../types';
import { compactModeReport } from './compactModeReport';

function makeFinding() {
    return {
        from: 'a.ts',
        to: 'b.ts',
        commonDepth: 1,
        residualDepth: 1,
        commonParent: '',
        relation: 'cross-boundary' as const,
        severity: 'warning' as const,
        interpretation: '',
        reasoning: [],
    };
}

function makePoint(overrides: Partial<HistoryPoint> = {}): HistoryPoint {
    return {
        commit: { sha: 'abc1234', date: '2026-01-01T00:00:00Z', title: 'a commit' },
        scannedFiles: 10,
        modules: 10,
        incremental: null,
        cumulative: null,
        ...overrides,
    };
}

describe('compactModeReport', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('reports no drift when no point has findings', () => {
        const logSpy = jest.spyOn(console, 'log');

        compactModeReport({
            points: [makePoint(), makePoint({ incremental: { findings: [] } })],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
        });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('No architectural drift detected')
        );
    });

    it('reports drift when any point has incremental findings under the incremental strategy', () => {
        const logSpy = jest.spyOn(console, 'log');

        compactModeReport({
            points: [makePoint({ incremental: { findings: [makeFinding()] } })],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
        });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('Architectural drift detected')
        );
    });

    it('ignores cumulative findings when the strategy is incremental-only', () => {
        const logSpy = jest.spyOn(console, 'log');

        compactModeReport({
            points: [makePoint({ cumulative: { findings: [makeFinding()] } })],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
        });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('No architectural drift detected')
        );
    });

    it('shows both incremental and cumulative counts when strategy is both', () => {
        const logSpy = jest.spyOn(console, 'log');

        compactModeReport({
            points: [
                makePoint({
                    incremental: { findings: [makeFinding()] },
                    cumulative: { findings: [makeFinding(), makeFinding()] },
                }),
            ],
            strategy: HISTORY_STRATEGIES.BOTH,
        });

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('incremental: 1'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cumulative: 2'));
    });

    it('prints a dash for the baseline point, which has no incremental/cumulative result', () => {
        const logSpy = jest.spyOn(console, 'log');

        compactModeReport({
            points: [makePoint()],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
        });

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('incremental: -'));
    });
});
