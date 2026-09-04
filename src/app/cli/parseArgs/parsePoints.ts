import { CLI_FLAG } from '../types';
import { getArgValue } from './getArgValue';
import { printHelp } from '../printHelp';

/**
 * A single sampled point can never produce a comparison (incremental and
 * cumulative both need a previous/first point to diff against), so the
 * minimum useful sample size for the history command is 2, not 1.
 */
export const MIN_HISTORY_POINTS = 2;

export function parsePoints(args: string[], defaultPoints: number): number {
    const raw = getArgValue(args, CLI_FLAG.POINTS);

    if (raw === undefined) {
        return defaultPoints;
    }

    const value = Number(raw);

    if (!Number.isInteger(value) || value < MIN_HISTORY_POINTS) {
        console.error(`Invalid --points "${raw}" (must be a whole number >= ${MIN_HISTORY_POINTS})\n`);
        printHelp();
        process.exit(1);
    }

    return value;
}
