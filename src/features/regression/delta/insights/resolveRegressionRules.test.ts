import { resolveRegressionRules } from './resolveRegressionRules';

describe('resolveRegressionRules', () => {
    const baseRules = {
        thresholds: {
            internalDepth: 3,
            deepInternalResidualDepth: 3,
        },
        severity: {
            'cross-boundary': 'warning' as const,
            'deep-internal': 'warning' as const,
            sibling: 'info' as const,
            internal: 'info' as const,
        },
    };

    it('should return global rules when no scopes are provided', () => {
        const result = resolveRegressionRules({
            sourcePath: 'src/features/payments/service.ts',
            rules: baseRules,
        });

        expect(result).toEqual({
            ignore: false,
            thresholds: {
                internalDepth: 3,
                deepInternalResidualDepth: 3,
            },
            severity: {
                'cross-boundary': 'warning',
                'deep-internal': 'warning',
                sibling: 'info',
                internal: 'info',
            },
        });
    });

    it('should apply severity overrides from matching scope', () => {
        const result = resolveRegressionRules({
            sourcePath: 'src/features/payments/service.ts',
            rules: baseRules,
            scopes: [
                {
                    match: 'src/features/**',
                    severity: {
                        sibling: 'error',
                    },
                },
            ],
        });

        expect(result.ignore).toBe(false);
        expect(result.severity).toEqual({
            'cross-boundary': 'warning',
            'deep-internal': 'warning',
            sibling: 'error',
            internal: 'info',
        });
        expect(result.thresholds).toEqual(baseRules.thresholds);
    });

    it('should apply threshold overrides from matching scope', () => {
        const result = resolveRegressionRules({
            sourcePath: 'src/features/payments/service.ts',
            rules: baseRules,
            scopes: [
                {
                    match: 'src/features/**',
                    thresholds: {
                        internalDepth: 5,
                    },
                },
            ],
        });

        expect(result.ignore).toBe(false);
        expect(result.thresholds).toEqual({
            internalDepth: 5,
            deepInternalResidualDepth: 3,
        });
        expect(result.severity).toEqual(baseRules.severity);
    });

    it('should ignore findings for matching scope', () => {
        const result = resolveRegressionRules({
            sourcePath: 'src/features/payments/service.ts',
            rules: baseRules,
            scopes: [
                {
                    match: 'src/features/**',
                    ignore: true,
                },
            ],
        });

        expect(result.ignore).toBe(true);
    });

    it('should apply more specific scopes after less specific ones', () => {
        const result = resolveRegressionRules({
            sourcePath: 'src/features/payments/service.ts',
            rules: baseRules,
            scopes: [
                {
                    match: 'src/features/**',
                    ignore: true,
                    severity: {
                        sibling: 'warning',
                    },
                },
                {
                    match: 'src/features/payments/**',
                    ignore: false,
                    severity: {
                        sibling: 'error',
                    },
                    thresholds: {
                        internalDepth: 7,
                    },
                },
            ],
        });

        expect(result).toEqual({
            ignore: false,
            thresholds: {
                internalDepth: 7,
                deepInternalResidualDepth: 3,
            },
            severity: {
                'cross-boundary': 'warning',
                'deep-internal': 'warning',
                sibling: 'error',
                internal: 'info',
            },
        });
    });

    it('should ignore non-matching scopes', () => {
        const result = resolveRegressionRules({
            sourcePath: 'src/core/scanProject.ts',
            rules: baseRules,
            scopes: [
                {
                    match: 'src/features/**',
                    ignore: true,
                    severity: {
                        sibling: 'error',
                    },
                    thresholds: {
                        internalDepth: 10,
                    },
                },
            ],
        });

        expect(result).toEqual({
            ignore: false,
            thresholds: {
                internalDepth: 3,
                deepInternalResidualDepth: 3,
            },
            severity: {
                'cross-boundary': 'warning',
                'deep-internal': 'warning',
                sibling: 'info',
                internal: 'info',
            },
        });
    });
});
