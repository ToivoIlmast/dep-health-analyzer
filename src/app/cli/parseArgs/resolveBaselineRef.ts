import { execSync } from 'node:child_process';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export function resolveBaselineRef(value?: string, fallbackRef = 'HEAD~1'): string {
    if (value) return value;

    try {
        execSync(`git rev-parse --verify ${fallbackRef}`, { stdio: 'ignore' });
        return fallbackRef;
    } catch {
        console.warn(
            `${YELLOW}\nNote: ${fallbackRef} could not be resolved (a shallow clone, or a repository ` +
                'with too few commits) - comparing against HEAD itself. This can only find real drift ' +
                'if you have uncommitted changes; otherwise the comparison is against an identical ' +
                `tree and will always report no findings.\n${RESET}`
        );
        return 'HEAD';
    }
}
