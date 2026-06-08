export function handleExit(results: boolean[]): void {
    const failed = results.some((result) => result === true);

    if (failed) {
        process.exit(1);
    }
}
