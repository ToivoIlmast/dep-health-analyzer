import { execSync } from 'node:child_process';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export function resolveBaselineRef(value?: string): string {
    if (value) return value;

    try {
        execSync('git rev-parse --verify HEAD~1', { stdio: 'ignore' });
        return 'HEAD~1';
    } catch {
        console.warn(
            `${YELLOW}\nNote: HEAD~1 could not be resolved (a shallow clone, or a repository with ` +
                'only one commit) - comparing against HEAD itself. This can only find real drift if ' +
                'you have uncommitted changes; otherwise the comparison is against an identical tree ' +
                `and will always report no findings.\n${RESET}`
        );
        return 'HEAD';
    }
}
