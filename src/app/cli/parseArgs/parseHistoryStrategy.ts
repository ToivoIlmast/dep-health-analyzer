import { HISTORY_STRATEGIES, HistoryStrategyType } from '@shared/types';
import { CLI_FLAG } from '../types';
import { getArgValue } from './getArgValue';
import { printHelp } from '../printHelp';

export function parseHistoryStrategy(
    args: string[],
    defaultStrategy: HistoryStrategyType
): HistoryStrategyType {
    const value = getArgValue(args, CLI_FLAG.STRATEGY) ?? defaultStrategy;
    const allowedStrategies = Object.values(HISTORY_STRATEGIES);

    if (!allowedStrategies.includes(value as HistoryStrategyType)) {
        console.error(`Invalid strategy "${value}"\n`);
        printHelp();
        process.exit(1);
    }

    return value as HistoryStrategyType;
}
