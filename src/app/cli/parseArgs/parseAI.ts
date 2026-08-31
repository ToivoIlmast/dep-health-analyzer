import { CLI_FLAG } from '../types';

export function parseAI(args: string[]): boolean {
    const value = args.indexOf(CLI_FLAG.AI) !== -1 ? true : false;

    return value;
}
