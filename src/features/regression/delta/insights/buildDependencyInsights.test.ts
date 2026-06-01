import { buildDependencyInsights } from './buildDependencyInsights';

it('should build dependency insight', () => {
    const result = buildDependencyInsights(
        {
            added: [
                {
                    from: 'src/features/auth/index.ts',
                    to: 'src/features/auth/utils/date.ts',
                },
            ],
            removed: [],
        },
        {
            thresholds: {
                internalDepth: 3,
                deepInternalResidualDepth: 3,
            },
            severity: {
                sibling: 'info',
                internal: 'info',
                'deep-internal': 'warning',
                'cross-boundary': 'error',
            },
        }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
        from: 'src/features/auth/index.ts',
        to: 'src/features/auth/utils/date.ts',
        relation: 'internal',
        severity: 'info',
    });
});
