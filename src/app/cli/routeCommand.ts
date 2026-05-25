import { analyzeCycles } from '@features/cycles/analyzeCycles';
import { analyzeRegression } from '@features/regression';
import { CLI_COMMANDS, CliArgs } from './types';

export async function routeCommand(args: CliArgs): Promise<boolean[]> {
    const { command, target, baselineRef, isCi, isHtml } = args;

    const results: boolean[] = [];

    if (command) {
        switch (command.toLowerCase()) {
            case CLI_COMMANDS.CYCLES.toLowerCase(): {
                await analyzeCycles(target);
                break;
            }

            case CLI_COMMANDS.REGRESSION.toLowerCase(): {
                const result = await analyzeRegression({
                    target,
                    baselineRef,
                    ci: isCi,
                    html: isHtml,
                    failOn: 'warning',
                });

                results.push(!!result);
                break;
            }

            default:
                break;
        }
    }

    return results;
}
