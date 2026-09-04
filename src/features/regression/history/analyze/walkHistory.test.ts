import type { ScanResult } from '@core/graph/types';
import type { HistoryCommit } from '../utils/getCommitHistory';

jest.mock('@core/scanProject', () => ({ scanProject: jest.fn() }));
jest.mock('../../utils/createBaselineWorktree', () => ({ createBaselineWorktree: jest.fn() }));
jest.mock('../../utils/removeBaselineWorktree', () => ({ removeBaselineWorktree: jest.fn() }));
jest.mock('../../utils/resolveWorktreeTarget', () => ({ resolveWorktreeTarget: jest.fn() }));
jest.mock('../../utils/validateGitRef', () => ({ validateGitRef: jest.fn() }));
jest.mock('../../delta/dependencyDelta', () => ({ calculateDependencyDelta: jest.fn() }));
jest.mock('../../delta/insights/buildDependencyInsights', () => ({
    buildDependencyInsights: jest.fn(),
}));
jest.mock('../utils/getCommitHistory', () => ({ getCommitHistory: jest.fn() }));
jest.mock('../utils/sampleCommits', () => ({ sampleCommits: jest.fn() }));
jest.mock('../utils/checkoutInWorktree', () => ({ checkoutInWorktree: jest.fn() }));

import { scanProject } from '@core/scanProject';
import { createBaselineWorktree } from '../../utils/createBaselineWorktree';
import { removeBaselineWorktree } from '../../utils/removeBaselineWorktree';
import { resolveWorktreeTarget } from '../../utils/resolveWorktreeTarget';
import { validateGitRef } from '../../utils/validateGitRef';
import { calculateDependencyDelta } from '../../delta/dependencyDelta';
import { buildDependencyInsights } from '../../delta/insights/buildDependencyInsights';
import { getCommitHistory } from '../utils/getCommitHistory';
import { sampleCommits } from '../utils/sampleCommits';
import { checkoutInWorktree } from '../utils/checkoutInWorktree';
import { walkHistory } from './walkHistory';

const mockedScanProject = jest.mocked(scanProject);
const mockedCreateBaselineWorktree = jest.mocked(createBaselineWorktree);
const mockedRemoveBaselineWorktree = jest.mocked(removeBaselineWorktree);
const mockedResolveWorktreeTarget = jest.mocked(resolveWorktreeTarget);
const mockedValidateGitRef = jest.mocked(validateGitRef);
const mockedCalculateDependencyDelta = jest.mocked(calculateDependencyDelta);
const mockedBuildDependencyInsights = jest.mocked(buildDependencyInsights);
const mockedGetCommitHistory = jest.mocked(getCommitHistory);
const mockedSampleCommits = jest.mocked(sampleCommits);
const mockedCheckoutInWorktree = jest.mocked(checkoutInWorktree);

function makeCommit(sha: string): HistoryCommit {
    return { sha, date: `2026-01-0${sha}T00:00:00Z`, title: `commit ${sha}` };
}

function makeScanResult(scannedFiles: number, nodeCount: number): ScanResult {
    return {
        graph: { nodes: new Set(Array.from({ length: nodeCount }, (_, i) => `n${i}.ts`)), edges: new Map() },
        scannedFiles,
        root: '/worktree',
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
    baselineRef: 'abc0',
    sampleSize: 3,
    rules,
};

describe('walkHistory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedValidateGitRef.mockReturnValue(true);
        mockedGetCommitHistory.mockReturnValue([makeCommit('1'), makeCommit('2'), makeCommit('3')]);
        mockedSampleCommits.mockImplementation((commits) => commits);
        mockedCreateBaselineWorktree.mockReturnValue('/tmp/history-worktree');
        mockedResolveWorktreeTarget.mockReturnValue('/tmp/history-worktree/.');
        mockedScanProject.mockResolvedValue(makeScanResult(1, 1));
        mockedCalculateDependencyDelta.mockReturnValue({ added: [], removed: [] });
        mockedBuildDependencyInsights.mockReturnValue([]);
    });

    it('throws for an invalid baseline ref without touching git or scanning', async () => {
        mockedValidateGitRef.mockReturnValue(false);

        await expect(walkHistory(baseArgs)).rejects.toThrow('Invalid git reference');
        expect(mockedCreateBaselineWorktree).not.toHaveBeenCalled();
        expect(mockedScanProject).not.toHaveBeenCalled();
    });

    it('throws for sampleSize below 2 without touching git at all - a single point can never produce a comparison', async () => {
        await expect(walkHistory({ ...baseArgs, sampleSize: 1 })).rejects.toThrow(
            'sampleSize must be at least 2'
        );
        expect(mockedValidateGitRef).not.toHaveBeenCalled();
        expect(mockedGetCommitHistory).not.toHaveBeenCalled();
        expect(mockedCreateBaselineWorktree).not.toHaveBeenCalled();
    });

    it('throws for sampleSize of 0', async () => {
        await expect(walkHistory({ ...baseArgs, sampleSize: 0 })).rejects.toThrow(
            'sampleSize must be at least 2'
        );
    });

    it('samples the full commit history down to the requested size', async () => {
        await walkHistory(baseArgs);

        expect(mockedSampleCommits).toHaveBeenCalledWith(
            [makeCommit('1'), makeCommit('2'), makeCommit('3')],
            3
        );
    });

    it('creates one worktree at the first sampled commit and reuses it for every point', async () => {
        await walkHistory(baseArgs);

        expect(mockedCreateBaselineWorktree).toHaveBeenCalledTimes(1);
        expect(mockedCreateBaselineWorktree).toHaveBeenCalledWith('1');
        expect(mockedCheckoutInWorktree).toHaveBeenCalledTimes(3);
        expect(mockedCheckoutInWorktree).toHaveBeenNthCalledWith(1, '/tmp/history-worktree', '1');
        expect(mockedCheckoutInWorktree).toHaveBeenNthCalledWith(2, '/tmp/history-worktree', '2');
        expect(mockedCheckoutInWorktree).toHaveBeenNthCalledWith(3, '/tmp/history-worktree', '3');
    });

    it('always removes the worktree, even when a scan throws', async () => {
        mockedScanProject.mockReset();
        mockedScanProject
            .mockResolvedValueOnce(makeScanResult(1, 1))
            .mockRejectedValueOnce(new Error('boom'));

        await expect(walkHistory(baseArgs)).rejects.toThrow('boom');

        expect(mockedRemoveBaselineWorktree).toHaveBeenCalledWith('/tmp/history-worktree');
    });

    it('removes the worktree on the successful path too', async () => {
        await walkHistory(baseArgs);

        expect(mockedRemoveBaselineWorktree).toHaveBeenCalledWith('/tmp/history-worktree');
    });

    it('marks the first point with null incremental and cumulative results', async () => {
        const result = await walkHistory(baseArgs);

        expect(result.points[0]?.incremental).toBeNull();
        expect(result.points[0]?.cumulative).toBeNull();
    });

    it('computes the incremental delta against the previous point, not the first point', async () => {
        const scan1 = makeScanResult(1, 1);
        const scan2 = makeScanResult(2, 2);
        const scan3 = makeScanResult(3, 3);
        mockedScanProject.mockReset();
        mockedScanProject
            .mockResolvedValueOnce(scan1)
            .mockResolvedValueOnce(scan2)
            .mockResolvedValueOnce(scan3);

        await walkHistory(baseArgs);

        expect(mockedCalculateDependencyDelta).toHaveBeenNthCalledWith(1, {
            current: scan2,
            baseline: scan1,
        });
        expect(mockedCalculateDependencyDelta).toHaveBeenNthCalledWith(3, {
            current: scan3,
            baseline: scan2,
        });
    });

    it('computes the cumulative delta against the first point for every later point', async () => {
        const scan1 = makeScanResult(1, 1);
        const scan2 = makeScanResult(2, 2);
        const scan3 = makeScanResult(3, 3);
        mockedScanProject.mockReset();
        mockedScanProject
            .mockResolvedValueOnce(scan1)
            .mockResolvedValueOnce(scan2)
            .mockResolvedValueOnce(scan3);

        await walkHistory(baseArgs);

        // Per point: call 1 = incremental, call 2 = cumulative. Point 2 is the
        // 1st/2nd calls, point 3 is the 3rd/4th - so cumulative calls are #2 and #4.
        expect(mockedCalculateDependencyDelta).toHaveBeenNthCalledWith(2, {
            current: scan2,
            baseline: scan1,
        });
        expect(mockedCalculateDependencyDelta).toHaveBeenNthCalledWith(4, {
            current: scan3,
            baseline: scan1,
        });
    });

    it('records scannedFiles and module count from each scan', async () => {
        mockedScanProject.mockReset();
        mockedScanProject.mockResolvedValue(makeScanResult(7, 4));

        const result = await walkHistory(baseArgs);

        expect(result.points[0]).toMatchObject({ scannedFiles: 7, modules: 4 });
    });

    it('passes scopes through to buildDependencyInsights', async () => {
        const scopes = [{ match: 'src/app/**', ignore: true }];

        await walkHistory({ ...baseArgs, scopes });

        expect(mockedBuildDependencyInsights).toHaveBeenCalledWith(
            { added: [], removed: [] },
            rules,
            scopes
        );
    });
});
