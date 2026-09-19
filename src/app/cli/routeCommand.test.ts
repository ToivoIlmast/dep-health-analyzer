import { routeCommand } from './routeCommand';
import { CLI_COMMANDS } from './types';
import { HISTORY_STRATEGIES, MODES } from '@shared/types';
import { analyzeCycles } from '@features/cycles/analyzeCycles';
import { analyzeHistory, analyzeRegression, explainHistory, explainRegression } from '@features/regression';
import { validateOllamaAIEnvironment } from '@features/regression/ai/validateAIEnvironment';
import { defaultConfig } from '../config/defaultConfig';

jest.mock('@features/cycles/analyzeCycles', () => ({
    analyzeCycles: jest.fn(),
}));

jest.mock('@features/regression', () => ({
    analyzeRegression: jest.fn(),
    explainRegression: jest.fn(),
    analyzeHistory: jest.fn(),
    explainHistory: jest.fn(),
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
            // F26: the runtime fallback (used when config omits this field,
            // as this test's config does) must be the SAME value
            // documented in defaultConfig.ts, not a second, independently
            // hardcoded literal - see the "runtime defaults vs
            // defaultConfig" describe block below for the general case.
            htmlReportOutputPath: defaultConfig.features.scc.reporting.html.outputPath,
            includeTypeOnlyImports: false,
            // F14/2.2 - same F26 reasoning as htmlReportOutputPath above.
            modulesInCyclesThreshold: defaultConfig.features.scc.modulesInCyclesThreshold,
        });
    });

    it('threads features.scc.typescript.includeTypeOnlyImports through to analyzeCycles', async () => {
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
                    scc: { enabled: true, typescript: { includeTypeOnlyImports: true } },
                },
            }
        );

        expect(analyzeCyclesMock).toHaveBeenCalledWith(
            expect.objectContaining({ includeTypeOnlyImports: true })
        );
    });

    it('lets cycles and regression have independent includeTypeOnlyImports values', async () => {
        const analyzeCyclesMock = analyzeCycles as jest.Mock;
        const analyzeRegressionMock = jest.mocked(analyzeRegression);

        analyzeCyclesMock.mockResolvedValue(false);
        analyzeRegressionMock.mockResolvedValue({ failed: false, findings: [] });

        const config = {
            features: {
                scc: { enabled: true, typescript: { includeTypeOnlyImports: true } },
                regression: { enabled: true, typescript: { includeTypeOnlyImports: false } },
            },
        };

        await routeCommand(
            { command: CLI_COMMANDS.CYCLES, target: './src', mode: MODES.FULL, ai: false },
            config
        );
        await routeCommand(
            {
                command: CLI_COMMANDS.REGRESSION,
                target: './src',
                baselineRef: 'HEAD~1',
                mode: MODES.FULL,
                ai: false,
            },
            config
        );

        expect(analyzeCyclesMock).toHaveBeenCalledWith(
            expect.objectContaining({ includeTypeOnlyImports: true })
        );
        expect(analyzeRegressionMock).toHaveBeenCalledWith(
            expect.objectContaining({ includeTypeOnlyImports: false })
        );
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

    it('should generate an AI explanation for history when AI is enabled and requested', async () => {
        const analyzeHistoryMock = jest.mocked(analyzeHistory);
        const explainHistoryMock = jest.mocked(explainHistory);
        const validateOllamaMock = jest.mocked(validateOllamaAIEnvironment);
        const points = [
            {
                commit: { sha: 'abc1234', date: '2026-01-01', title: 'a' },
                scannedFiles: 1,
                modules: 1,
                incremental: null,
                cumulative: null,
            },
        ];
        const result = { failed: false, points };
        const ai = {
            enabled: true,
            provider: 'ollama' as const,
            host: 'http://localhost:11434',
            model: 'qwen3:14b',
            language: 'English',
        };

        analyzeHistoryMock.mockResolvedValue(result);

        await routeCommand(
            {
                command: CLI_COMMANDS.HISTORY,
                target: './src',
                baselineRef: 'HEAD~20',
                sampleSize: 8,
                strategy: HISTORY_STRATEGIES.INCREMENTAL,
                mode: MODES.COMPACT,
                ai: true,
            },
            {
                features: {
                    regression: {
                        history: { enabled: true },
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
        expect(explainHistoryMock).toHaveBeenCalledWith({ data: { points }, aiConfig: ai });
    });

    it('should not generate an AI explanation for history when AI is not requested', async () => {
        const analyzeHistoryMock = jest.mocked(analyzeHistory);
        const explainHistoryMock = jest.mocked(explainHistory);

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
                        ai: { enabled: true, provider: 'ollama' },
                    },
                },
            }
        );

        expect(explainHistoryMock).not.toHaveBeenCalled();
    });
});

// F26 (AUDIT_v0.11.0.md): `loadConfig` never merges `defaultConfig.ts` - the
// values a user actually gets when a field is omitted come entirely from
// `??` fallbacks hardcoded separately in routeCommand.ts, which had drifted
// from the documented defaults (`outputPath` under two different
// directories/filenames, `failOn` 'error' vs 'warning'). These tests derive
// their expectation from `defaultConfig` itself, never from a second
// hardcoded literal - so they catch the SOURCES disagreeing, not just a
// snapshot of today's values.
describe('routeCommand runtime defaults vs defaultConfig (F26)', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('falls back to defaultConfig\'s scc html outputPath when config omits it', async () => {
        const analyzeCyclesMock = jest.mocked(analyzeCycles);
        analyzeCyclesMock.mockResolvedValue(false);

        await routeCommand(
            { command: CLI_COMMANDS.CYCLES, target: '.', mode: MODES.FULL, ai: false },
            { features: { scc: { enabled: true } } }
        );

        expect(analyzeCyclesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                htmlReportOutputPath: defaultConfig.features.scc.reporting.html.outputPath,
            })
        );
    });

    // F14/2.2: the new gating threshold must follow the exact same
    // single-source-of-truth rule F26 already established for every other
    // scc/regression runtime default on this page - never a second,
    // independently hardcoded literal in routeCommand.ts.
    it('falls back to defaultConfig\'s scc modulesInCyclesThreshold when config omits it', async () => {
        const analyzeCyclesMock = jest.mocked(analyzeCycles);
        analyzeCyclesMock.mockResolvedValue(false);

        await routeCommand(
            { command: CLI_COMMANDS.CYCLES, target: '.', mode: MODES.FULL, ai: false },
            { features: { scc: { enabled: true } } }
        );

        expect(analyzeCyclesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                modulesInCyclesThreshold: defaultConfig.features.scc.modulesInCyclesThreshold,
            })
        );
    });

    it('passes an explicit scc.modulesInCyclesThreshold from config through unchanged, rather than always using the default', async () => {
        const analyzeCyclesMock = jest.mocked(analyzeCycles);
        analyzeCyclesMock.mockResolvedValue(false);

        await routeCommand(
            { command: CLI_COMMANDS.CYCLES, target: '.', mode: MODES.FULL, ai: false },
            { features: { scc: { enabled: true, modulesInCyclesThreshold: 25 } } }
        );

        expect(analyzeCyclesMock).toHaveBeenCalledWith(expect.objectContaining({ modulesInCyclesThreshold: 25 }));
    });

    it('falls back to defaultConfig\'s regression html outputPath when config omits it', async () => {
        const analyzeRegressionMock = jest.mocked(analyzeRegression);
        analyzeRegressionMock.mockResolvedValue({ failed: false, findings: [] });

        await routeCommand(
            {
                command: CLI_COMMANDS.REGRESSION,
                target: '.',
                baselineRef: 'HEAD~1',
                mode: MODES.FULL,
                ai: false,
            },
            { features: { regression: { enabled: true } } }
        );

        expect(analyzeRegressionMock).toHaveBeenCalledWith(
            expect.objectContaining({
                htmlReportOutputPath: defaultConfig.features.regression.reporting.html.outputPath,
            })
        );
    });

    it('falls back to defaultConfig\'s history html outputPath when config omits it', async () => {
        const analyzeHistoryMock = jest.mocked(analyzeHistory);
        analyzeHistoryMock.mockResolvedValue({ failed: false, points: [] });

        await routeCommand(
            {
                command: CLI_COMMANDS.HISTORY,
                target: '.',
                baselineRef: 'HEAD~1',
                sampleSize: 2,
                strategy: HISTORY_STRATEGIES.INCREMENTAL,
                mode: MODES.COMPACT,
                ai: false,
            },
            { features: { regression: { history: { enabled: true } } } }
        );

        expect(analyzeHistoryMock).toHaveBeenCalledWith(
            expect.objectContaining({
                htmlReportOutputPath: defaultConfig.features.regression.history.reporting.html.outputPath,
            })
        );
    });

    it('falls back to defaultConfig\'s regression failOn when config omits it', async () => {
        const analyzeRegressionMock = jest.mocked(analyzeRegression);
        analyzeRegressionMock.mockResolvedValue({ failed: false, findings: [] });

        await routeCommand(
            {
                command: CLI_COMMANDS.REGRESSION,
                target: '.',
                baselineRef: 'HEAD~1',
                mode: MODES.FULL,
                ai: false,
            },
            { features: { regression: { enabled: true } } }
        );

        expect(analyzeRegressionMock).toHaveBeenCalledWith(
            expect.objectContaining({ failOn: defaultConfig.features.regression.failOn })
        );
    });

    it('falls back to defaultConfig\'s regression failOn for history too, when config omits it', async () => {
        const analyzeHistoryMock = jest.mocked(analyzeHistory);
        analyzeHistoryMock.mockResolvedValue({ failed: false, points: [] });

        await routeCommand(
            {
                command: CLI_COMMANDS.HISTORY,
                target: '.',
                baselineRef: 'HEAD~1',
                sampleSize: 2,
                strategy: HISTORY_STRATEGIES.INCREMENTAL,
                mode: MODES.COMPACT,
                ai: false,
            },
            { features: { regression: { history: { enabled: true } } } }
        );

        expect(analyzeHistoryMock).toHaveBeenCalledWith(
            expect.objectContaining({ failOn: defaultConfig.features.regression.failOn })
        );
    });
});
