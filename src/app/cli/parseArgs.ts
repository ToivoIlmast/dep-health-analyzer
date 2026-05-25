import { CLI_FLAG, CliArgs } from './types';

export function parseArgs(): CliArgs {
    const args = process.argv.slice(2);
    const isCi = args.includes(CLI_FLAG.CI);
    const isHtml = args.includes(CLI_FLAG.HTML);
    const command = args[0];
    const target = args.find((arg) => !arg.startsWith('--') && arg !== command) ?? '.';
    const baselineRef =
        args.find((arg) => !arg.startsWith('--') && arg !== command && arg !== target) ??
        'origin/master';

    return {
        command,
        target,
        baselineRef,
        isCi,
        isHtml,
    };
}
