import { HISTORY_STRATEGIES } from '@shared/types';
import type { HistoryPoint } from '../types';
import { fullModeReport } from './fullModeReport';

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

describe('fullModeReport', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('labels the first point as the baseline for both strategies', () => {
        const logSpy = jest.spyOn(console, 'log');

        fullModeReport({ points: [makePoint()], strategy: HISTORY_STRATEGIES.BOTH });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('baseline point, nothing precedes it')
        );
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('this IS the baseline point'));
    });

    it('only prints the incremental section when strategy is incremental', () => {
        const logSpy = jest.spyOn(console, 'log');

        fullModeReport({ points: [makePoint()], strategy: HISTORY_STRATEGIES.INCREMENTAL });

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Incremental'));
        expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Cumulative'));
    });

    it('only prints the cumulative section when strategy is cumulative', () => {
        const logSpy = jest.spyOn(console, 'log');

        fullModeReport({ points: [makePoint()], strategy: HISTORY_STRATEGIES.CUMULATIVE });

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cumulative'));
        expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Incremental'));
    });

    it('prints commit metadata for every point', () => {
        const logSpy = jest.spyOn(console, 'log');

        fullModeReport({
            points: [
                makePoint({ commit: { sha: 'deadbee', date: '2026-02-02T00:00:00Z', title: 'second' } }),
            ],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
        });

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('deadbee'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('second'));
    });
});
