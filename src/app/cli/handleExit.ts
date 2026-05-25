export function handleExit(results: boolean[]): void {
    const failed = results.some((result) => result === false);

    if (failed) {
        process.exit(1);
    }
}
