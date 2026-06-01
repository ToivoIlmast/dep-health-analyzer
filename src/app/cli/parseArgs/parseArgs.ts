import { IConfig } from 'app/config/types';
import { CLI_COMMANDS, CLI_FLAG, CliArgs } from '../types';
import { parseCommand } from './parseCommand';
import { getArgValue } from './getArgValue';
import { parseMode } from './parseMode';
import { resolveBaselineRef } from './resolveBaselineRef';
import { MODES } from '@shared/types';

export function parseArgs(config: IConfig): CliArgs {
    const args = process.argv.slice(2);
    const command = parseCommand(args[0]);

    const defaultMode =
        command === CLI_COMMANDS.REGRESSION
            ? (config.features?.regression?.mode ?? MODES.FULL)
            : (config.features?.scc?.mode ?? MODES.FULL);

    // these are common flags
    const target = getArgValue(args, CLI_FLAG.TARGET) ?? '.';
    const mode = parseMode(args, defaultMode);

    // this flag is only for regression
    const baselineRef = resolveBaselineRef(getArgValue(args, CLI_FLAG.BASELINE));

    return {
        command,
        target,
        baselineRef,
        mode,
    };
}
