import { execFileSync } from 'node:child_process';
import { MODES } from '@shared/types';
import type { ScanResult } from '@core/graph/types';

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));
jest.mock('@core/scanProject', () => ({ scanProject: jest.fn() }));
jest.mock('../utils/createBaselineWorktree', () => ({ createBaselineWorktree: jest.fn() }));
jest.mock('../utils/removeBaselineWorktree', () => ({ removeBaselineWorktree: jest.fn() }));
jest.mock('../utils/validateGitRef', () => ({ validateGitRef: jest.fn() }));
jest.mock('../delta/dependencyDelta', () => ({ calculateDependencyDelta: jest.fn() }));
jest.mock('../delta/insights/buildDependencyInsights', () => ({
    buildDependencyInsights: jest.fn(),
}));
jest.mock('../ci/reporting/defaultModeReport/defaultModeReport', () => ({
    defaultModeReport: jest.fn(),
}));
jest.mock('../ci/reporting/ciModeReport', () => ({ ciModeReport: jest.fn() }));
jest.mock('../visualization', () => ({ htmlModeReport: jest.fn() }));

import { scanProject } from '@core/scanProject';
import { createBaselineWorktree } from '../utils/createBaselineWorktree';
import { removeBaselineWorktree } from '../utils/removeBaselineWorktree';
import { validateGitRef } from '../utils/validateGitRef';
import { calculateDependencyDelta } from '../delta/dependencyDelta';
import { buildDependencyInsights } from '../delta/insights/buildDependencyInsights';
import { defaultModeReport } from '../ci/reporting/defaultModeReport/defaultModeReport';
import { ciModeReport } from '../ci/reporting/ciModeReport';
import { htmlModeReport } from '../visualization';
import { analyzeRegression } from './analyzeRegression';

const mockedExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;
const mockedScanProject = jest.mocked(scanProject);
const mockedCreateBaselineWorktree = jest.mocked(createBaselineWorktree);
const mockedRemoveBaselineWorktree = jest.mocked(removeBaselineWorktree);
const mockedValidateGitRef = jest.mocked(validateGitRef);
const mockedCalculateDependencyDelta = jest.mocked(calculateDependencyDelta);
const mockedBuildDependencyInsights = jest.mocked(buildDependencyInsights);
const mockedDefaultModeReport = jest.mocked(defaultModeReport);
const mockedCiModeReport = jest.mocked(ciModeReport);
const mockedHtmlModeReport = jest.mocked(htmlModeReport);

function makeScanResult(scannedFiles = 1): ScanResult {
    return {
        graph: { nodes: new Set(['a.ts']), edges: new Map() },
        scannedFiles,
        root: '/project',
    };
}

function makeFinding(overrides: Partial<{ severity: 'info' | 'warning' | 'error' }> = {}) {
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
    baselineRef: 'HEAD~1',
    mode: MODES.COMPACT,
    failOn: 'warning' as const,
    rules,
    isHtmlReportingEnabled: true,
    htmlReportOutputPath: './out.html',
};

describe('analyzeRegression', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedValidateGitRef.mockReturnValue(true);
        mockedExecFileSync.mockImplementation((_cmd, args) => {
            const argv = (args as string[]) ?? [];
            if (argv.includes('--show-toplevel')) return '/project\n';
            if (argv[0] === 'rev-parse') return 'abc1234\n';
            if (argv[0] === 'log') return 'baseline commit title\n';
            return '';
        });
        mockedCreateBaselineWorktree.mockReturnValue('/tmp/baseline-worktree');
        mockedScanProject
            .mockResolvedValueOnce(makeScanResult(5))
            .mockResolvedValueOnce(makeScanResult(4));
        mockedCalculateDependencyDelta.mockReturnValue({ added: [], removed: [] });
        mockedBuildDependencyInsights.mockReturnValue([]);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should always remove the baseline worktree, even when scanning the baseline throws', async () => {
        mockedScanProject.mockReset();
        mockedScanProject
            .mockResolvedValueOnce(makeScanResult(5)) // current scan succeeds
            .mockRejectedValueOnce(new Error('boom')); // baseline scan fails

        await expect(analyzeRegression(baseArgs)).rejects.toThrow('boom');

        expect(mockedRemoveBaselineWorktree).toHaveBeenCalledWith('/tmp/baseline-worktree');
    });

    it('should remove the baseline worktree on the successful path too', async () => {
        await analyzeRegression(baseArgs);

        expect(mockedRemoveBaselineWorktree).toHaveBeenCalledWith('/tmp/baseline-worktree');
    });

    it('should reject an invalid baseline ref before scanning anything', async () => {
        mockedValidateGitRef.mockReturnValue(false);

        await analyzeRegression(baseArgs);

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Invalid git reference')
        );
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should not fail when no findings meet the failOn severity', async () => {
        mockedBuildDependencyInsights.mockReturnValue([makeFinding({ severity: 'info' })]);

        const result = await analyzeRegression({ ...baseArgs, failOn: 'warning' });

        expect(result.failed).toBe(false);
    });

    it('should fail when a finding meets or exceeds the failOn severity', async () => {
        mockedBuildDependencyInsights.mockReturnValue([makeFinding({ severity: 'warning' })]);

        const result = await analyzeRegression({ ...baseArgs, failOn: 'warning' });

        expect(result.failed).toBe(true);
    });

    it('should return the findings it computed', async () => {
        const findings = [makeFinding({ severity: 'error' })];
        mockedBuildDependencyInsights.mockReturnValue(findings);

        const result = await analyzeRegression(baseArgs);

        expect(result.findings).toBe(findings);
    });

    it('should dispatch to the compact reporter in compact mode', async () => {
        await analyzeRegression({ ...baseArgs, mode: MODES.COMPACT });

        expect(mockedCiModeReport).toHaveBeenCalled();
        expect(mockedDefaultModeReport).not.toHaveBeenCalled();
        expect(mockedHtmlModeReport).not.toHaveBeenCalled();
    });

    it('should dispatch to the full reporter in full mode', async () => {
        await analyzeRegression({ ...baseArgs, mode: MODES.FULL });

        expect(mockedDefaultModeReport).toHaveBeenCalled();
        expect(mockedCiModeReport).not.toHaveBeenCalled();
    });

    it('should generate an HTML report when mode is html and reporting is enabled', async () => {
        await analyzeRegression({ ...baseArgs, mode: MODES.HTML, isHtmlReportingEnabled: true });

        expect(mockedHtmlModeReport).toHaveBeenCalledWith(
            expect.objectContaining({ outputPath: './out.html' })
        );
    });

    it('should warn and skip the report when html mode is requested but disabled in config', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await analyzeRegression({ ...baseArgs, mode: MODES.HTML, isHtmlReportingEnabled: false });

        expect(mockedHtmlModeReport).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HTML reporting is disabled in config.')
        );
    });

    it('should pass scopes through to buildDependencyInsights', async () => {
        const scopes = [{ match: 'src/app/**', ignore: true }];

        await analyzeRegression({ ...baseArgs, scopes });

        expect(mockedBuildDependencyInsights).toHaveBeenCalledWith(
            { added: [], removed: [] },
            rules,
            scopes
        );
    });
});
