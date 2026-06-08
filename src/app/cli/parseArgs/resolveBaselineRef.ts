import { execSync } from 'node:child_process';

export function resolveBaselineRef(value?: string): string {
    if (value) return value;

    try {
        execSync('git rev-parse --verify HEAD~1', { stdio: 'ignore' });
        return 'HEAD~1';
    } catch {
        return 'HEAD';
    }
}
