import { CLI_FLAG } from '../types';
import { getArgValue } from './getArgValue';
import { printHelp } from '../printHelp';

const DEFAULT_TARGET = '.';

/**
 * `--target` omitted entirely and `--target` present but missing a value
 * are NOT the same thing: the first legitimately means "scan the current
 * directory" (the existing default); the second is almost always a user
 * mistake (a forgotten path, or another flag typed right after it - see
 * getArgValue.ts) and must be a controlled error, never a silent fallback
 * to the current directory or to `undefined`.
 */
export function parseTarget(args: string[]): string {
    if (!args.includes(CLI_FLAG.TARGET)) {
        return DEFAULT_TARGET;
    }

    const value = getArgValue(args, CLI_FLAG.TARGET);

    if (value === undefined) {
        console.error(`Missing value for ${CLI_FLAG.TARGET}\n`);
        printHelp();
        process.exit(1);
    }

    return value as string;
}
