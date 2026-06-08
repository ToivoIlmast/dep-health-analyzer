import { analyzeCycles } from '@features/cycles/analyzeCycles';
import { analyzeRegression } from '@features/regression';
import { CLI_COMMANDS, CliArgs } from './types';
import { IConfig } from '../config/types';

export async function routeCommand(args: CliArgs, config: IConfig): Promise<boolean[]> {
    const { command, target, mode } = args;

    const results: boolean[] = [];

    switch (command) {
        case CLI_COMMANDS.CYCLES: {
            const sccConfig = config.features?.scc;

            if (!sccConfig?.enabled) {
                break;
            }

            const result = await analyzeCycles({
                target,
                mode,
                failOn: config.features?.scc?.failOn ?? 'error',
                enableHtmlReport: config.features?.scc?.reporting?.html?.enabled ?? true,
                htmlReportOutputPath:
                    config.features?.scc?.reporting?.html?.outputPath ?? './reports/cycles.html',
            });

            results.push(!!result);
            break;
        }

        case CLI_COMMANDS.REGRESSION: {
            const regressionConfig = config.features?.regression;

            if (!regressionConfig?.enabled) {
                break;
            }

            const result = await analyzeRegression({
                target,
                baselineRef: args.baselineRef,
                mode,
                failOn: config.features?.regression?.failOn ?? 'error',
                rules: {
                    thresholds: {
                        deepInternalResidualDepth:
                            regressionConfig.thresholds?.deepInternalResidualDepth ?? 3,
                        internalDepth: regressionConfig.thresholds?.internalDepth ?? 3,
                    },
                    severity: {
                        'cross-boundary':
                            regressionConfig.severity?.['cross-boundary'] ?? 'warning',
                        'deep-internal': regressionConfig.severity?.['deep-internal'] ?? 'warning',
                        sibling: regressionConfig.severity?.sibling ?? 'info',
                        internal: regressionConfig.severity?.internal ?? 'info',
                    },
                },
                isHtmlReportingEnabled:
                    config.features?.regression?.reporting?.html?.enabled ?? true,
                htmlReportOutputPath:
                    config.features?.regression?.reporting?.html?.outputPath ??
                    './reports/regression.html',
            });

            results.push(!!result);
            break;
        }
    }

    return results;
}
