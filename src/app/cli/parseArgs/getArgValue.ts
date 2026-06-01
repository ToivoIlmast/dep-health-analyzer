export function getArgValue(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);

    if (index === -1) {
        return undefined;
    }

    return args[index + 1];
}
