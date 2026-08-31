import { buildRegressionPrompt } from './buildRegressionPrompt';
import { buildRegressionPromptData } from './buildRegressionPromptData';
import { explainRegression } from './explainRegression';
import { generateAISummary } from './generateAISummary';

jest.mock('./buildRegressionPrompt', () => ({
    buildRegressionPrompt: jest.fn(),
}));

jest.mock('./buildRegressionPromptData', () => ({
    buildRegressionPromptData: jest.fn(),
}));

jest.mock('./generateAISummary', () => ({
    generateAISummary: jest.fn(),
}));

describe('explainRegression', () => {
    const aiConfig = {
        provider: 'ollama' as const,
        host: 'http://localhost:11434',
        model: 'qwen3:14b',
        language: 'English',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not generate a summary when there are no observations', async () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.mocked(buildRegressionPromptData).mockReturnValue({ observations: {} });
        jest.mocked(buildRegressionPrompt).mockReturnValue('prompt');

        await explainRegression({ data: { failed: false, findings: [] }, aiConfig });

        expect(generateAISummary).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith('No observations available for AI summary.');

        consoleLogSpy.mockRestore();
    });

    it('should generate a summary from available observations', async () => {
        const promptData = {
            observations: {
                deepInternalSources: ['src/features/auth/AuthService.ts'],
            },
        };
        jest.mocked(buildRegressionPromptData).mockReturnValue(promptData);
        jest.mocked(buildRegressionPrompt).mockReturnValue('generated prompt');
        jest.mocked(generateAISummary).mockResolvedValue();

        const data = { failed: true, findings: [] };
        await explainRegression({ data, aiConfig });

        expect(buildRegressionPromptData).toHaveBeenCalledWith(data);
        expect(buildRegressionPrompt).toHaveBeenCalledWith({ analyseData: promptData, aiConfig });
        expect(generateAISummary).toHaveBeenCalledWith({ prompt: 'generated prompt', aiConfig });
    });
});
