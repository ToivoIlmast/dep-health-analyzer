import { getTrendInsights } from '../analyze/getTrendInsights';
import { buildHistoryPrompt } from './buildHistoryPrompt';
import { buildHistoryPromptData } from './buildHistoryPromptData';
import { explainHistory } from './explainHistory';
import { generateAISummary } from '../../ai/generateAISummary';

jest.mock('../analyze/getTrendInsights', () => ({ getTrendInsights: jest.fn() }));
jest.mock('./buildHistoryPrompt', () => ({ buildHistoryPrompt: jest.fn() }));
jest.mock('./buildHistoryPromptData', () => ({ buildHistoryPromptData: jest.fn() }));
jest.mock('../../ai/generateAISummary', () => ({ generateAISummary: jest.fn() }));

const mockedGetTrendInsights = jest.mocked(getTrendInsights);
const mockedBuildHistoryPrompt = jest.mocked(buildHistoryPrompt);
const mockedBuildHistoryPromptData = jest.mocked(buildHistoryPromptData);
const mockedGenerateAISummary = jest.mocked(generateAISummary);

describe('explainHistory', () => {
    const aiConfig = {
        provider: 'ollama' as const,
        host: 'http://localhost:11434',
        model: 'qwen3:14b',
        language: 'English',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetTrendInsights.mockReturnValue({ classification: 'stable', spikes: [], worstWindow: null });
    });

    it('should not generate a summary when there are no observations', async () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockedBuildHistoryPromptData.mockReturnValue({ observations: {} });
        mockedBuildHistoryPrompt.mockReturnValue('prompt');

        await explainHistory({ data: { points: [] }, aiConfig });

        expect(mockedGenerateAISummary).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith('No observations available for AI summary.');

        consoleLogSpy.mockRestore();
    });

    it('should generate a summary from available observations', async () => {
        const promptData = {
            observations: { trendClassification: 'worsening', sampledPointCount: 10 },
        };
        mockedBuildHistoryPromptData.mockReturnValue(promptData);
        mockedBuildHistoryPrompt.mockReturnValue('generated prompt');
        mockedGenerateAISummary.mockResolvedValue();

        const points = [
            { commit: { sha: 'a', date: '2026-01-01', title: 't' }, scannedFiles: 1, modules: 1, incremental: null, cumulative: null },
        ];
        await explainHistory({ data: { points }, aiConfig });

        expect(mockedGetTrendInsights).toHaveBeenCalledWith(points);
        expect(mockedBuildHistoryPromptData).toHaveBeenCalledWith({
            insights: { classification: 'stable', spikes: [], worstWindow: null },
            pointCount: 1,
        });
        expect(mockedBuildHistoryPrompt).toHaveBeenCalledWith({ analyseData: promptData, aiConfig });
        expect(mockedGenerateAISummary).toHaveBeenCalledWith({ prompt: 'generated prompt', aiConfig });
    });
});
