import { buildReasoning, getInterpretation, getRelation } from './relationClassifier';

describe('relationClassifier', () => {
    const thresholds = {
        internalDepth: 3,
        deepInternalResidualDepth: 3,
    };

    describe('getRelation', () => {
        it('should classify sibling dependency', () => {
            expect(
                getRelation({
                    from: 'src/components/Table.tsx',
                    to: 'src/components/Button.tsx',
                    commonDepth: 2,
                    residualDepth: 0,
                    thresholds,
                })
            ).toBe('sibling');
        });

        it('should classify internal dependency', () => {
            expect(
                getRelation({
                    from: 'src/features/auth/index.ts',
                    to: 'src/features/auth/utils/date.ts',
                    commonDepth: 3,
                    residualDepth: 1,
                    thresholds,
                })
            ).toBe('internal');
        });

        it('should classify deep internal dependency', () => {
            expect(
                getRelation({
                    from: 'src/features/auth/index.ts',
                    to: 'src/features/auth/a/b/c/file.ts',
                    commonDepth: 3,
                    residualDepth: 3,
                    thresholds,
                })
            ).toBe('deep-internal');
        });

        it('should classify cross boundary dependency', () => {
            expect(
                getRelation({
                    from: 'src/features/auth/index.ts',
                    to: 'src/shared/utils/date.ts',
                    commonDepth: 1,
                    residualDepth: 2,
                    thresholds,
                })
            ).toBe('cross-boundary');
        });
    });

    describe('getInterpretation', () => {
        test.each([
            ['sibling', 'likely sibling module dependency'],
            ['internal', 'likely internal module dependency'],
            ['deep-internal', 'deep internal dependency traversal'],
            ['cross-boundary', 'possible cross-boundary dependency'],
        ] as const)('should return interpretation for %s', (relation, expected) => {
            expect(getInterpretation(relation)).toBe(expected);
        });
    });

    describe('buildReasoning', () => {
        it('should build reasoning for sibling dependency', () => {
            const reasoning = buildReasoning({
                relation: 'sibling',
                commonDepth: 2,
                residualDepth: 0,
                commonParent: 'src/components',
            });

            expect(reasoning).toContain('same parent directory detected');
        });

        it('should build reasoning for internal dependency', () => {
            const reasoning = buildReasoning({
                relation: 'internal',
                commonDepth: 3,
                residualDepth: 1,
                commonParent: 'src/features/auth',
            });

            expect(reasoning).toContain('deep shared structural area detected');
        });

        it('should build reasoning for deep internal dependency', () => {
            const reasoning = buildReasoning({
                relation: 'deep-internal',
                commonDepth: 3,
                residualDepth: 4,
                commonParent: 'src/features/auth',
            });

            expect(reasoning).toContain('deep internal traversal detected');
        });

        it('should build reasoning for cross boundary dependency', () => {
            const reasoning = buildReasoning({
                relation: 'cross-boundary',
                commonDepth: 1,
                residualDepth: 2,
                commonParent: 'src',
            });

            expect(reasoning).toContain('dependency crosses structural boundary');
        });

        it('should include common depth, residual depth and common parent', () => {
            const reasoning = buildReasoning({
                relation: 'cross-boundary',
                commonDepth: 1,
                residualDepth: 2,
                commonParent: 'src',
            });

            expect(reasoning).toContain('Common Depth = 1');
            expect(reasoning).toContain('Residual Depth = 2');
            expect(reasoning).toContain('Common Parent = src');
        });
    });
});
