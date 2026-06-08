import { MODES, ModeType } from '@shared/types';
import { CLI_FLAG } from '../types';
import { getArgValue } from './getArgValue';
import { printHelp } from '../printHelp';

export function parseMode(args: string[], defaultMode: ModeType): ModeType {
    const value = getArgValue(args, CLI_FLAG.MODE) ?? defaultMode;
    const allowedModes = Object.values(MODES);

    if (!allowedModes.includes(value as ModeType)) {
        console.error(`Invalid mode "${value}"\n`);
        printHelp();
        process.exit(1);
    }

    return value as ModeType;
}
