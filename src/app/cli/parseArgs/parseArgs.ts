import { IConfig } from 'app/config/types';
import { CLI_COMMANDS, CLI_FLAG, CliArgs } from '../types';
import { parseCommand } from './parseCommand';
import { getArgValue } from './getArgValue';
import { parseMode } from './parseMode';
import { parseHistoryStrategy } from './parseHistoryStrategy';
import { resolveBaselineRef } from './resolveBaselineRef';
import { HISTORY_STRATEGIES, MODES } from '@shared/types';
import { parseAI } from './parseAI';

export function parseArgs(config: IConfig): CliArgs {
    const args = process.argv.slice(2);
    const command = parseCommand(args[0]);

    const defaultMode =
        command === CLI_COMMANDS.REGRESSION
            ? (config.features?.regression?.mode ?? MODES.FULL)
            : command === CLI_COMMANDS.HISTORY
              ? (config.features?.regression?.history?.mode ?? MODES.COMPACT)
              : (config.features?.scc?.mode ?? MODES.FULL);

    // these are common flags
    const target = getArgValue(args, CLI_FLAG.TARGET) ?? '.';
    const mode = parseMode(args, defaultMode);
    const ai = parseAI(args) ?? false;

    // this flag is only for regression and history
    const baselineRef = resolveBaselineRef(getArgValue(args, CLI_FLAG.BASELINE));

    // these flags are only for history
    const pointsArg = getArgValue(args, CLI_FLAG.POINTS);
    const sampleSize = pointsArg
        ? Number(pointsArg)
        : (config.features?.regression?.history?.sampleSize ?? 10);
    const strategy = parseHistoryStrategy(
        args,
        config.features?.regression?.history?.strategy ?? HISTORY_STRATEGIES.INCREMENTAL
    );

    if (command === CLI_COMMANDS.HISTORY) {
        return {
            command,
            target,
            baselineRef,
            mode,
            ai,
            sampleSize,
            strategy,
        };
    }

    return {
        command,
        target,
        baselineRef,
        mode,
        ai,
    };
}
