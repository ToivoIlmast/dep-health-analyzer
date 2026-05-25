import { commands } from './types';

export function validateCommand(command: string | undefined): void {
    if (!command || !commands.includes(command)) {
        console.log(`
            dep-health-analyzer

            Usage:
            dep-health-analyzer cycles <path>
            dep-health-analyzer regression <branch>
            dep-health-analyzer regression --ci <branch>
            dep-health-analyzer regression --html <branch>

            Examples:
            dep-health-analyzer cycles ./src
            dep-health-analyzer regression --ci origin/main
        `);

        process.exit(1);
    }
}
