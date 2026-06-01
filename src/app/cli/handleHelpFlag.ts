import { CLI_FLAG } from './types';
import { printHelp } from './printHelp';

export function handleHelpFlag(args: string[] = process.argv.slice(2)): void {
    if (!args.includes(CLI_FLAG.HELP)) {
        return;
    }

    printHelp();

    process.exit(0);
}
