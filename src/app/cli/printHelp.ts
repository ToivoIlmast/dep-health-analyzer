export function printHelp(): void {
    console.log(`
        Usage:
        dep-health-analyzer <command> [options]

        Commands:
        regression              Analyze architectural regressions
        cycles                  Analyze circular dependencies
        history                 Analyze architectural regression trends across commit history

        Global Options:
        --init                  Generate default configuration file
        --version, -v           Show current version
        --help                  Help

        Options:
        --target <path>         Target directory
        --baseline <ref>        Git reference for comparison / start of history
        --mode <mode>           Output mode
        --points <n>            (history only) Number of commits to sample (>= 2)
        --strategy <strategy>   (history only) Comparison strategy
        --ai                    (regression/history only) Generate an AI summary via Ollama

        Modes:
        full                    Verbose console output
        compact                 Compact CI-friendly output
        html                    Generate HTML report

        Strategies (history only):
        incremental             Compare each sampled commit to the previous one
        cumulative              Compare each sampled commit to the first one
        both                    Show both comparisons

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

        dep-health-analyzer regression \\
            --target ./src \\
            --ai

        dep-health-analyzer cycles

        dep-health-analyzer cycles \\
            --target ./src
        
        dep-health-analyzer cycles \\
            --target ./src \\
            --mode compact
        
        dep-health-analyzer cycles \\
            --target ./src \\
            --mode html

        dep-health-analyzer history

        dep-health-analyzer history \\
            --baseline HEAD~50 \\
            --points 10

        dep-health-analyzer history \\
            --baseline HEAD~50 \\
            --points 10 \\
            --strategy cumulative \\
            --mode full

        dep-health-analyzer history \\
            --baseline HEAD~50 \\
            --points 10 \\
            --strategy both \\
            --mode html

        dep-health-analyzer history \\
            --baseline HEAD~50 \\
            --points 10 \\
            --ai
    `);
}
