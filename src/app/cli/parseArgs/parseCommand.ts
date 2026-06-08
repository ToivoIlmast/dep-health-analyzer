import { printHelp } from '../printHelp';
import { CLI_COMMANDS, CommandType } from '../types';

export function parseCommand(value: string | undefined): CommandType {
    const allowedModes = Object.values(CLI_COMMANDS);

    if (!allowedModes.includes(value as CommandType)) {
        printHelp();
        process.exit(1);
    }

    return value as CommandType;
}
