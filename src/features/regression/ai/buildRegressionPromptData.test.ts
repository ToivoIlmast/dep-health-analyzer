import { DependencyInsight } from '../types';
import { buildRegressionPromptData } from './buildRegressionPromptData';

function createFinding(overrides: Partial<DependencyInsight> = {}): DependencyInsight {
    return {
        from: 'src/features/auth/AuthService.ts',
        to: 'src/core/logger.ts',
        commonDepth: 1,
        residualDepth: 1,
        commonParent: 'src',
        relation: 'internal',
        severity: 'info',
        interpretation: 'likely internal module dependency',
        reasoning: [],
        ...overrides,
    };
}

describe('buildRegressionPromptData', () => {
    it('should return empty observations when there are no findings', () => {
        const result = buildRegressionPromptData({
            failed: false,
            findings: [],
        });

        expect(result).toEqual({ observations: {} });
    });

    it('should aggregate and sort dependency hotspots by source file', () => {
        const result = buildRegressionPromptData({
            failed: false,
            findings: [
                createFinding({ from: 'src/core/scanProject.ts' }),
                createFinding({ from: 'src/features/auth/AuthService.ts' }),
                createFinding({ from: 'src/features/auth/AuthService.ts' }),
                createFinding({ from: 'src/features/auth/AuthService.ts' }),
            ],
        });

        expect(result.observations.topHotspots).toEqual([
            {
                source: 'src/features/auth/AuthService.ts',
                dependencyCount: 3,
            },
            {
                source: 'src/core/scanProject.ts',
                dependencyCount: 1,
            },
        ]);
    });

    it('should limit hotspots to ten source files', () => {
        const findings = Array.from({ length: 11 }, (_, index) =>
            createFinding({ from: `src/features/feature-${index}/index.ts` })
        );

        const result = buildRegressionPromptData({ failed: false, findings });

        expect(result.observations.topHotspots).toHaveLength(10);
        expect(result.observations.topHotspots?.[0]).toEqual({
            source: 'src/features/feature-0/index.ts',
            dependencyCount: 1,
        });
    });

    it('should collect unique areas and sources only from relevant relations', () => {
        const result = buildRegressionPromptData({
            failed: false,
            findings: [
                createFinding({
                    from: 'src/features/auth/AuthService.ts',
                    to: 'src/core/logger/logger.ts',
                    relation: 'cross-boundary',
                }),
                createFinding({
                    from: 'src/features/auth/PermissionService.ts',
                    to: 'src/core/scanProject.ts',
                    relation: 'cross-boundary',
                }),
                createFinding({
                    from: 'src/features/auth/AuthService.ts',
                    to: 'src/features/auth/internal/token.ts',
                    relation: 'deep-internal',
                }),
                createFinding({
                    from: 'src/features/auth/AuthService.ts',
                    to: 'src/features/auth/internal/session.ts',
                    relation: 'deep-internal',
                }),
                createFinding({ relation: 'sibling' }),
            ],
        });

        expect(result.observations.areasConnectedByNewDependencies).toEqual([
            'src/features',
            'src/core',
        ]);
        expect(result.observations.deepInternalSources).toEqual([
            'src/features/auth/AuthService.ts',
        ]);
    });
});
