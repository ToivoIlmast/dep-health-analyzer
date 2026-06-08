/* import { IConfig } from '../config/types';
import { printHelp } from './printHelp';
import { CLI_COMMANDS, CLI_FLAG, CliArgs, CommandType } from './types';
import { execSync } from 'node:child_process';
import { ModeType, MODES } from '@shared/types';
import { parseCommand } from './parseArgs/parseCommand';
import { getArgValue } from './parseArgs/getArgValue';
import { parseMode } from './parseArgs/parseMode';
import { resolveBaselineRef } from './parseArgs/resolveBaselineRef'; */

/* function parseCommand(value: string | undefined): CommandType {
    const allowedModes = Object.values(CLI_COMMANDS);

    if (!allowedModes.includes(value as CommandType)) {
        printHelp();
        process.exit(1);
    }

    return value as CommandType;
} */

/* function getArgValue(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);

    if (index === -1) {
        return undefined;
    }

    return args[index + 1];
} */

/* function parseMode(args: string[], defaultMode: ModeType): ModeType {
    const value = getArgValue(args, CLI_FLAG.MODE) ?? defaultMode;
    const allowedModes = Object.values(MODES);

    if (!allowedModes.includes(value as ModeType)) {
        console.error(`Invalid mode "${value}"\n`);
        printHelp();
        process.exit(1);
    }

    return value as ModeType;
} */

/* function resolveBaselineRef(value?: string): string {
    if (value) return value;

    try {
        execSync('git rev-parse --verify HEAD~1', { stdio: 'ignore' });
        return 'HEAD~1';
    } catch {
        return 'HEAD';
    }
} */

/* export function parseArgs(config: IConfig): CliArgs {
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
} */
