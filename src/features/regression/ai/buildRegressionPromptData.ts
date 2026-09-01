import { RegressionAnalysisResult } from '../types';
import { RegressionPromptData } from './types';

/**
 * Maps a file path to a high-level project area used in AI summaries.
 *
 * Examples:
 * src/features/regression/analyze/analyzeRegression.ts
 *   -> src/features/regression
 *
 * src/core/scanProject.ts
 *   -> src/core
 *
 * src/shared/types.ts
 *   -> src/shared
 */
function getModuleArea(path: string): string {
    const parts = path.split('/');

    if (parts.length >= 2) {
        return parts.slice(0, 2).join('/');
    }

    return path;
}

export function buildRegressionPromptData(args: RegressionAnalysisResult): RegressionPromptData {
    const { findings } = args;

    const observations: RegressionPromptData['observations'] = {};

    //
    // topHotspots
    //

    const hotspotMap = new Map<string, number>();

    for (const finding of findings) {
        hotspotMap.set(finding.from, (hotspotMap.get(finding.from) ?? 0) + 1);
    }

    const topHotspots = Array.from(hotspotMap.entries())
        .map(([source, dependencyCount]) => ({
            source,
            dependencyCount,
        }))
        .sort((a, b) => b.dependencyCount - a.dependencyCount)
        .slice(0, 10);

    if (topHotspots.length > 0) {
        observations.topHotspots = topHotspots;
    }

    //
    // areasConnectedByNewDependencies
    //

    const areasConnectedByNewDependencies = [
        ...new Set(
            findings
                .filter((finding) => finding.relation === 'cross-boundary')
                .flatMap((finding) => [getModuleArea(finding.from), getModuleArea(finding.to)])
        ),
    ];

    if (areasConnectedByNewDependencies.length > 0) {
        observations.areasConnectedByNewDependencies = areasConnectedByNewDependencies;
    }

    //
    // deepInternalSources
    //

    const deepInternalSources = [
        ...new Set(
            findings
                .filter((finding) => finding.relation === 'deep-internal')
                .map((finding) => finding.from)
        ),
    ];

    if (deepInternalSources.length > 0) {
        observations.deepInternalSources = deepInternalSources;
    }

    return {
        observations,
    };
}
