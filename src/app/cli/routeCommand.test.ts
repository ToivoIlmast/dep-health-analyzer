import { routeCommand } from './routeCommand';
import { CLI_COMMANDS } from './types';
import { MODES } from '@shared/types';
import { analyzeCycles } from '@features/cycles/analyzeCycles';
import { analyzeRegression } from '@features/regression';

jest.mock('@features/cycles/analyzeCycles', () => ({
    analyzeCycles: jest.fn(),
}));

jest.mock('@features/regression', () => ({
    analyzeRegression: jest.fn(),
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

        analyzeRegressionMock.mockResolvedValue(false);

        await routeCommand(
            {
                command: CLI_COMMANDS.REGRESSION,
                target: './src',
                baselineRef: 'HEAD',
                mode: MODES.FULL,
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
});
