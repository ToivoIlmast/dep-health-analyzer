import { ModeType } from '@shared/types';

export const CLI_FLAG = {
    TARGET: '--target',
    BASELINE: '--baseline',
    MODE: '--mode',
    VERSION: '--version',
    VERSION_SHORT: '-v',
    INIT: '--init',
    HELP: '--help',
    AI: '--ai',
} as const;

type BaseArgs = {
    target: string;
    mode: ModeType;
    ai: boolean;
};

type RegressionArgs = {
    command: 'regression';
    baselineRef: string;
} & BaseArgs;

type CyclesArgs = {
    command: 'cycles';
} & BaseArgs;

export type CliArgs = RegressionArgs | CyclesArgs;
export type CommandType = CliArgs['command'];

export const CLI_COMMANDS = {
    CYCLES: 'cycles',
    REGRESSION: 'regression',
} as const;
