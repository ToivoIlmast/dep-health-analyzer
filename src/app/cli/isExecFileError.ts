/**
 * execFileSync (used for every git operation in this codebase) throws an
 * Error with a numeric `status` (the child process's exit code) when the
 * command fails. With `stdio: 'inherit'` (used for git operations whose
 * output is worth showing live), the child process has already printed its
 * own error directly to the terminal by the time this catches it - so the
 * cleanest thing to show on top is a short, styled line, not a second raw
 * Node stack trace repeating information the user already saw.
 */
export function isExecFileError(err: unknown): err is Error & { status: number } {
    return err instanceof Error && 'status' in err && typeof err.status === 'number';
}
