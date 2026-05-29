export function printHelp(): void {
    console.log(`
        Usage:
        dep-health <command> [options]

        Commands:
        regression              Analyze architectural regressions
        cycles                  Analyze circular dependencies

        Options:
        --target <path>         Target directory
        --baseline <ref>        Git reference for comparison
        --mode <mode>           Output mode

        Modes:
        full                    Verbose console output
        compact                 Compact CI-friendly output
        html                    Generate HTML report

        Examples:
        dep-health regression

        dep-health regression \\
            --target ./src

        dep-health regression \\
            --target ./src \\
            --baseline HEAD~3

        dep-health regression \\
            --target ./src \\
            --mode compact

        dep-health regression \\
            --target ./src \\
            --mode html
    `);
}
