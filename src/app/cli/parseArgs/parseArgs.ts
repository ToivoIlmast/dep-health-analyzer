import { IConfig } from 'app/config/types';
import { CLI_COMMANDS, CLI_FLAG, CliArgs } from '../types';
import { parseCommand } from './parseCommand';
import { getArgValue } from './getArgValue';
import { parseMode } from './parseMode';
import { parsePoints } from './parsePoints';
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

    // these flags are only for history
    const sampleSize = parsePoints(args, config.features?.regression?.history?.sampleSize ?? 10);
    const strategy = parseHistoryStrategy(
        args,
        config.features?.regression?.history?.strategy ?? HISTORY_STRATEGIES.INCREMENTAL
    );

    // this flag is only for regression and history - history's default
    // fallback must reach back sampleSize-1 commits, not a fixed HEAD~1,
    // otherwise the sampled range is always exactly 2 commits regardless
    // of --points whenever --baseline isn't given.
    const baselineRef =
        command === CLI_COMMANDS.HISTORY
            ? resolveBaselineRef(getArgValue(args, CLI_FLAG.BASELINE), `HEAD~${sampleSize - 1}`)
            : resolveBaselineRef(getArgValue(args, CLI_FLAG.BASELINE));

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
