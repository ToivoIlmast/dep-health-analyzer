import fs from 'node:fs';
import { HISTORY_STRATEGIES } from '@shared/types';
import type { HistoryPoint } from '../types';

jest.mock('node:fs', () => ({
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
}));
jest.mock('./template', () => ({ buildHistoryHtmlTemplate: jest.fn(() => '<html>mock</html>') }));

import { buildHistoryHtmlTemplate } from './template';
import { htmlModeReport } from './htmlModeReport';

const mockedMkdirSync = jest.mocked(fs.mkdirSync);
const mockedWriteFileSync = jest.mocked(fs.writeFileSync);
const mockedBuildTemplate = jest.mocked(buildHistoryHtmlTemplate);

function makePoint(): HistoryPoint {
    return {
        commit: { sha: 'abc1234', date: '2026-01-01T00:00:00Z', title: 'a commit' },
        scannedFiles: 10,
        modules: 10,
        incremental: null,
        cumulative: null,
    };
}

describe('htmlModeReport (history)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('creates the output directory before writing the report', () => {
        htmlModeReport({
            points: [makePoint()],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
            outputPath: './dep-health-reports/history.html',
        });

        expect(mockedMkdirSync).toHaveBeenCalledWith(
            expect.stringContaining('dep-health-reports'),
            { recursive: true }
        );
    });

    it('writes the built template to the resolved output path', () => {
        htmlModeReport({
            points: [makePoint()],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
            outputPath: './dep-health-reports/history.html',
        });

        expect(mockedWriteFileSync).toHaveBeenCalledWith(
            expect.stringContaining('history.html'),
            '<html>mock</html>'
        );
    });

    it('passes points, strategy, target, and baselineRef through to the template builder', () => {
        const points = [makePoint()];

        htmlModeReport({
            points,
            strategy: HISTORY_STRATEGIES.CUMULATIVE,
            target: './src',
            baselineRef: 'HEAD~20',
            outputPath: './out.html',
        });

        expect(mockedBuildTemplate).toHaveBeenCalledWith({
            points,
            strategy: HISTORY_STRATEGIES.CUMULATIVE,
            target: './src',
            baselineRef: 'HEAD~20',
        });
    });
});
