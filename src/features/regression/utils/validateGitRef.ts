import { execSync } from 'node:child_process';

export function validateGitRef(ref: string): boolean {
    try {
        execSync(`git rev-parse --verify ${ref}`, {
            stdio: 'ignore',
        });

        return true;
    } catch {
        return false;
    }
}
