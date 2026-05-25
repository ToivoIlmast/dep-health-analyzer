export type CliArgs = {
    command: string | undefined;
    target: string;
    baselineRef: string;
    isCi: boolean;
    isHtml: boolean;
};

export const commands = ['cycles', 'regression'];
export const CLI_COMMANDS = {
    CYCLES: 'cycles',
    REGRESSION: 'regression',
} as const;

export const flags = ['--ci', '--html'];
export const CLI_FLAG = {
    CI: '--ci',
    HTML: '--html',
} as const;
