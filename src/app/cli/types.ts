import { ModeType } from '@shared/types';

export const CLI_FLAG = {
    TARGET: '--target',
    BASELINE: '--baseline',
    MODE: '--mode',
    VERSION: '--version',
    VERSION_SHORT: '-v',
    INIT: '--init',
} as const;

type RegressionArgs = {
    command: 'regression';
    target: string;
    baselineRef: string;
    mode: ModeType;
};

type CyclesArgs = {
    command: 'cycles';
    target: string;
    mode: ModeType;
};

export type CliArgs = RegressionArgs | CyclesArgs;
export type CommandType = CliArgs['command'];

export const CLI_COMMANDS = {
    CYCLES: 'cycles',
    REGRESSION: 'regression',
} as const;
