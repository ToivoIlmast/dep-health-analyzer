import { routeCommand } from './routeCommand';
import { CLI_COMMANDS } from './types';
import { HISTORY_STRATEGIES, MODES } from '@shared/types';
import { analyzeCycles } from '@features/cycles/analyzeCycles';
import { analyzeHistory, analyzeRegression, explainRegression } from '@features/regression';
import { validateOllamaAIEnvironment } from '@features/regression/ai/validateAIEnvironment';

jest.mock('@features/cycles/analyzeCycles', () => ({
    analyzeCycles: jest.fn(),
}));

jest.mock('@features/regression', () => ({
    analyzeRegression: jest.fn(),
    explainRegression: jest.fn(),
    analyzeHistory: jest.fn(),
}));

jest.mock('@features/regression/ai/validateAIEnvironment', () => ({
    validateOllamaAIEnvironment: jest.fn(),
}));

describe('routeCommand', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should call analyzeCycles for cycles command', async () => {
        const analyzeCyclesMock = analyzeCycles as jest.Mock;

        analyzeCyclesMock.mockResolvedValue(false);

        await routeCommand(
            {
                command: CLI_COMMANDS.CYCLES,
                target: './src',
                mode: MODES.FULL,
                ai: false,
            },
            {
                features: {
                    scc: {
                        enabled: true,
                    },
                },
            }
        );

        expect(analyzeCyclesMock).toHaveBeenCalledTimes(1);
        expect(analyzeCyclesMock).toHaveBeenCalledWith({
            target: './src',
            mode: MODES.FULL,
            failOn: 'error',
            enableHtmlReport: true,
            htmlReportOutputPath: './reports/cycles.html',
        });
    });

    it('should not call analyzeCycles when scc is disabled', async () => {
        const analyzeCyclesMock = jest.mocked(analyzeCycles);

        await routeCommand(
            {
                command: CLI_COMMANDS.CYCLES,
                target: './src',
                mode: MODES.FULL,
                ai: false,
            },
            {
                features: {
                    scc: {
                        enabled: false,
                    },
                },
            }
        );

        expect(analyzeCyclesMock).not.toHaveBeenCalled();
    });

    it('should call analyzeRegression for regression command', async () => {
        const analyzeRegressionMock = jest.mocked(analyzeRegression);

        analyzeRegressionMock.mockResolvedValue({
            failed: false,
            findings: [],
        });

        await routeCommand(
            {
                command: CLI_COMMANDS.REGRESSION,
                target: './src',
                baselineRef: 'HEAD',
                mode: MODES.FULL,
                ai: false,
            },
            {
                features: {
                    regression: {
                        enabled: true,
                        severity: {},
                        thresholds: {},
                    },
                },
            }
        );

        expect(analyzeRegressionMock).toHaveBeenCalledTimes(1);
    });

    it('should not call analyzeRegression when regression is disabled', async () => {
        const analyzeRegressionMock = jest.mocked(analyzeRegression);

        await routeCommand(
            {
                command: CLI_COMMANDS.REGRESSION,
                target: './src',
                baselineRef: 'HEAD',
                mode: MODES.FULL,
                ai: false,
            },
            {
                features: {
                    regression: {
                        enabled: false,
                        severity: {},
                        thresholds: {},
                    },
                },
            }
        );

        expect(analyzeRegressionMock).not.toHaveBeenCalled();
    });

    it('should return analyzer result for cycles command', async () => {
        const analyzeCyclesMock = jest.mocked(analyzeCycles);

        analyzeCyclesMock.mockResolvedValue(true);

        const result = await routeCommand(
            {
                command: CLI_COMMANDS.CYCLES,
                target: './src',
                mode: MODES.FULL,
                ai: false,
            },
            {
                features: {
                    scc: {
                        enabled: true,
                    },
                },
            }
        );

        expect(result).toEqual([true]);
    });

    it('should generate an AI explanation when AI is enabled and requested', async () => {
        const analyzeRegressionMock = jest.mocked(analyzeRegression);
        const explainRegressionMock = jest.mocked(explainRegression);
        const validateOllamaMock = jest.mocked(validateOllamaAIEnvironment);
        const result = { failed: false, findings: [] };
        const ai = {
            enabled: true,
            provider: 'ollama' as const,
            host: 'http://localhost:11434',
            model: 'qwen3:14b',
            language: 'English',
        };

        analyzeRegressionMock.mockResolvedValue(result);

        await routeCommand(
            {
                command: CLI_COMMANDS.REGRESSION,
                target: './src',
                baselineRef: 'HEAD',
                mode: MODES.FULL,
                ai: true,
            },
            {
                features: {
                    regression: {
                        enabled: true,
                        severity: {},
                        thresholds: {},
                        ai,
                    },
                },
            }
        );

        expect(validateOllamaMock).toHaveBeenCalledWith({
            model: 'qwen3:14b',
            host: 'http://localhost:11434',
        });
        expect(explainRegressionMock).toHaveBeenCalledWith({ data: result, aiConfig: ai });
    });

    it('should call analyzeHistory for history command', async () => {
        const analyzeHistoryMock = jest.mocked(analyzeHistory);

        analyzeHistoryMock.mockResolvedValue({ failed: false, points: [] });

        await routeCommand(
            {
                command: CLI_COMMANDS.HISTORY,
                target: './src',
                baselineRef: 'HEAD~20',
                sampleSize: 8,
                strategy: HISTORY_STRATEGIES.INCREMENTAL,
                mode: MODES.COMPACT,
                ai: false,
            },
            {
                features: {
                    regression: {
                        history: { enabled: true },
                        severity: {},
                        thresholds: {},
                    },
                },
            }
        );

        expect(analyzeHistoryMock).toHaveBeenCalledTimes(1);
        expect(analyzeHistoryMock).toHaveBeenCalledWith(
            expect.objectContaining({
                target: './src',
                baselineRef: 'HEAD~20',
                sampleSize: 8,
                strategy: HISTORY_STRATEGIES.INCREMENTAL,
                mode: MODES.COMPACT,
            })
        );
    });

    it('should not call analyzeHistory when history is disabled', async () => {
        const analyzeHistoryMock = jest.mocked(analyzeHistory);

        await routeCommand(
            {
                command: CLI_COMMANDS.HISTORY,
                target: './src',
                baselineRef: 'HEAD~20',
                sampleSize: 8,
                strategy: HISTORY_STRATEGIES.INCREMENTAL,
                mode: MODES.COMPACT,
                ai: false,
            },
            {
                features: {
                    regression: {
                        history: { enabled: false },
                    },
                },
            }
        );

        expect(analyzeHistoryMock).not.toHaveBeenCalled();
    });

    it('should return the analyzer result for history command', async () => {
        const analyzeHistoryMock = jest.mocked(analyzeHistory);

        analyzeHistoryMock.mockResolvedValue({ failed: true, points: [] });

        const result = await routeCommand(
            {
                command: CLI_COMMANDS.HISTORY,
                target: './src',
                baselineRef: 'HEAD~20',
                sampleSize: 8,
                strategy: HISTORY_STRATEGIES.INCREMENTAL,
                mode: MODES.COMPACT,
                ai: false,
            },
            {
                features: {
                    regression: {
                        history: { enabled: true },
                    },
                },
            }
        );

        expect(result).toEqual([true]);
    });
});
