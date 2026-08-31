export const defaultConfig = {
    $schema: './src/app/config/config.schema.json',

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
        },

        scc: {
            enabled: true,
            mode: 'compact',
            failOn: 'error',
            reporting: {
                html: {
                    enabled: true,
                    outputPath: './dep-health-reports/scc.html',
                },
            },
            severity: 'error',
            maxSize: 10,
        },
    },
} as const;
