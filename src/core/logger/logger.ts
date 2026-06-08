export const verbose = process.argv.includes('--verbose');

export function debug(...args: unknown[]) {
    if (verbose) {
        console.log(...args);
    }
}
