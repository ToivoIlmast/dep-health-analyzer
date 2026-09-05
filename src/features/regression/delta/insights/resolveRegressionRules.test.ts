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

    it('applies later scopes after earlier ones, so a later override wins', () => {
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

    it('does not let a longer but broader match outrank a shorter but narrower one declared later - order decides, not string length', () => {
        // Previously, specificity was measured as raw match-string length,
        // so this long directory-wide ignore would apply LAST (as the
        // "more specific" one) regardless of where it was declared,
        // silently defeating the narrower single-file exception below it.
        // Declaration order removes that ambiguity entirely: whichever
        // scope is written later simply applies later.
        const result = resolveRegressionRules({
            sourcePath: 'src/some-very-long-directory-name-chosen-for-realism-here/hotfile.ts',
            rules: baseRules,
            scopes: [
                {
                    match: '**/some-very-long-directory-name-chosen-for-realism-here/**',
                    ignore: true,
                },
                {
                    match: '**/hotfile.ts',
                    ignore: false,
                },
            ],
        });

        expect(result.ignore).toBe(false);
    });

    it('does not let a leading "!" whole-pattern-negate a scope match into matching everything, including the path it looks like it should exclude', () => {
        // A config author reaching for the intuitive "everything except
        // vendor" extglob idiom - without minimatch's `nonegate` guard,
        // minimatch strips the leading "!", tests the near-never-matching
        // literal remainder "(src/vendor/**)", and negates that false result
        // to true for virtually every path, including src/vendor itself -
        // silently escalating the exact file the scope was meant to exempt.
        const result = resolveRegressionRules({
            sourcePath: 'src/vendor/consumer.ts',
            rules: baseRules,
            scopes: [
                {
                    match: '!(src/vendor/**)',
                    severity: { 'cross-boundary': 'error' },
                },
            ],
        });

        expect(result.severity['cross-boundary']).toBe('warning');
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
