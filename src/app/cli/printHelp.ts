export function printHelp(): void {
    console.log(`
        Usage:
        dep-health-analyzer <command> [options]

        Commands:
        regression              Analyze architectural regressions
        cycles                  Analyze circular dependencies

        Global Options:
        --init                  Generate default configuration file
        --version, -v           Show current version
        --help                  Help

        Options:
        --target <path>         Target directory
        --baseline <ref>        Git reference for comparison
        --mode <mode>           Output mode

        Modes:
        full                    Verbose console output
        compact                 Compact CI-friendly output
        html                    Generate HTML report

        Examples:
        dep-health-analyzer --init

        dep-health-analyzer --version

        dep-health-analyzer --help

        dep-health-analyzer regression

        dep-health-analyzer regression \\
            --target ./src

        dep-health-analyzer regression \\
            --target ./src \\
            --baseline HEAD~3

        dep-health-analyzer regression \\
            --target ./src \\
            --mode compact

        dep-health-analyzer regression \\
            --target ./src \\
            --mode html

        dep-health-analyzer cycles

        dep-health-analyzer cycles \\
            --target ./src
        
        dep-health-analyzer cycles \\
            --target ./src \\
            --mode compact
        
        dep-health-analyzer cycles \\
            --target ./src \\
            --mode html
    `);
}
