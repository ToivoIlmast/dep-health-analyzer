import { execFileSync } from 'node:child_process';

export function validateGitRef(ref: string): boolean {
    if (!ref || ref.startsWith('-')) {
        return false;
    }

    try {
        execFileSync('git', ['rev-parse', '--verify', ref], {
            stdio: 'ignore',
        });

        return true;
    } catch {
        return false;
    }
}
