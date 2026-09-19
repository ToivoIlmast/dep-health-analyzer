export const defaultConfig = {
    // A remote URL, not a repo-relative path: this file is copied verbatim
    // into every user's generated config via `--init`, and a relative path
    // to the schema only resolves inside this repo itself, not in an
    // installed package (the raw schema isn't shipped in `dist`). A remote
    // URL works the same for every install layout (npm, pnpm, monorepos).
    $schema:
        'https://raw.githubusercontent.com/ToivoIlmast/dep-health-analyzer/master/src/app/config/config.schema.json',

    features: {
        regression: {
            enabled: true,
            mode: 'compact',
            failOn: 'warning',
            reporting: {
                html: {
                    enabled: true,

                    outputPath: './dep-health-reports/regression.html',
                },
            },

            ai: {
                enabled: true,
                provider: 'ollama',
                host: 'http://localhost:11434',
                model: 'qwen3:14b',
                language: 'en',
            },

            severity: {
                'cross-boundary': 'warning',
                'deep-internal': 'warning',
                sibling: 'info',
                internal: 'info',
            },

            thresholds: {
                internalDepth: 3,
                deepInternalResidualDepth: 3,
            },

            history: {
                enabled: true,
                sampleSize: 10,
                strategy: 'incremental',
                mode: 'compact',
                reporting: {
                    html: {
                        enabled: true,
                        outputPath: './dep-health-reports/history.html',
                    },
                },
            },

            typescript: {
                includeTypeOnlyImports: false,
            },
        },

        scc: {
            enabled: true,
            mode: 'compact',
            failOn: 'error',
            // F14/2.2: 0 fails on any real cycle at all - the exact
            // behavior this tool already had before this threshold
            // existed. Raise it to only fail once the SUM across every
            // real cyclic SCC (not any single SCC's own size) exceeds a
            // number you choose.
            modulesInCyclesThreshold: 0,
            reporting: {
                html: {
                    enabled: true,
                    outputPath: './dep-health-reports/scc.html',
                },
            },
            severity: 'error',
            maxSize: 10,

            typescript: {
                includeTypeOnlyImports: false,
            },
        },
    },
} as const;
