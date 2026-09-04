import { HISTORY_STRATEGIES, MODES } from '@shared/types';
import type { HistoryPoint } from '../types';

jest.mock('../../utils/validateGitRef', () => ({ validateGitRef: jest.fn() }));
jest.mock('./walkHistory', () => ({ walkHistory: jest.fn() }));
jest.mock('../ci/compactModeReport', () => ({ compactModeReport: jest.fn() }));
jest.mock('../ci/fullModeReport', () => ({ fullModeReport: jest.fn() }));

import { validateGitRef } from '../../utils/validateGitRef';
import { walkHistory } from './walkHistory';
import { compactModeReport } from '../ci/compactModeReport';
import { fullModeReport } from '../ci/fullModeReport';
import { analyzeHistory } from './analyzeHistory';

const mockedValidateGitRef = jest.mocked(validateGitRef);
const mockedWalkHistory = jest.mocked(walkHistory);
const mockedCompactModeReport = jest.mocked(compactModeReport);
const mockedFullModeReport = jest.mocked(fullModeReport);

function makeFinding(severity: 'info' | 'warning' | 'error' = 'warning') {
    return {
        from: 'a.ts',
        to: 'b.ts',
        commonDepth: 1,
        residualDepth: 1,
        commonParent: '',
        relation: 'cross-boundary' as const,
        severity,
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

const rules = {
    thresholds: { internalDepth: 3, deepInternalResidualDepth: 3 },
    severity: {
        'cross-boundary': 'warning' as const,
        'deep-internal': 'warning' as const,
        sibling: 'info' as const,
        internal: 'info' as const,
    },
};

const baseArgs = {
    target: '.',
    baselineRef: 'HEAD~10',
    sampleSize: 5,
    strategy: HISTORY_STRATEGIES.INCREMENTAL,
    mode: MODES.COMPACT,
    failOn: 'warning' as const,
    rules,
};

describe('analyzeHistory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedValidateGitRef.mockReturnValue(true);
        mockedWalkHistory.mockResolvedValue({ points: [makePoint()] });
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('rejects an invalid baseline ref before walking any history', async () => {
        mockedValidateGitRef.mockReturnValue(false);

        await analyzeHistory(baseArgs);

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid git reference'));
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('does not fail when no findings meet the failOn severity', async () => {
        mockedWalkHistory.mockResolvedValue({
            points: [makePoint({ incremental: { findings: [makeFinding('info')] } })],
        });

        const result = await analyzeHistory({ ...baseArgs, failOn: 'warning' });

        expect(result.failed).toBe(false);
    });

    it('fails when an incremental finding meets the failOn severity', async () => {
        mockedWalkHistory.mockResolvedValue({
            points: [makePoint({ incremental: { findings: [makeFinding('warning')] } })],
        });

        const result = await analyzeHistory({ ...baseArgs, failOn: 'warning' });

        expect(result.failed).toBe(true);
    });

    it('ignores cumulative findings when strategy is incremental-only', async () => {
        mockedWalkHistory.mockResolvedValue({
            points: [makePoint({ cumulative: { findings: [makeFinding('error')] } })],
        });

        const result = await analyzeHistory({
            ...baseArgs,
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            failOn: 'warning',
        });

        expect(result.failed).toBe(false);
    });

    it('considers cumulative findings when strategy is cumulative', async () => {
        mockedWalkHistory.mockResolvedValue({
            points: [makePoint({ cumulative: { findings: [makeFinding('error')] } })],
        });

        const result = await analyzeHistory({
            ...baseArgs,
            strategy: HISTORY_STRATEGIES.CUMULATIVE,
            failOn: 'warning',
        });

        expect(result.failed).toBe(true);
    });

    it('dispatches to the compact reporter in compact mode', async () => {
        await analyzeHistory({ ...baseArgs, mode: MODES.COMPACT });

        expect(mockedCompactModeReport).toHaveBeenCalled();
        expect(mockedFullModeReport).not.toHaveBeenCalled();
    });

    it('dispatches to the full reporter in full mode', async () => {
        await analyzeHistory({ ...baseArgs, mode: MODES.FULL });

        expect(mockedFullModeReport).toHaveBeenCalled();
        expect(mockedCompactModeReport).not.toHaveBeenCalled();
    });

    it('warns and skips both reporters in html mode, since the chart is not implemented yet', async () => {
        await analyzeHistory({ ...baseArgs, mode: MODES.HTML });

        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('not implemented yet'));
        expect(mockedCompactModeReport).not.toHaveBeenCalled();
        expect(mockedFullModeReport).not.toHaveBeenCalled();
    });

    it('passes sampleSize through to walkHistory', async () => {
        await analyzeHistory({ ...baseArgs, sampleSize: 7 });

        expect(mockedWalkHistory).toHaveBeenCalledWith(
            expect.objectContaining({ sampleSize: 7 })
        );
    });
});
