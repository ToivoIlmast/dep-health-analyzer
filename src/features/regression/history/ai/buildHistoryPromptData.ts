import { TrendInsights } from '../analyze/getTrendInsights';
import { HistoryPromptData } from './types';

/**
 * Matches buildRegressionPromptData's topHotspots cap: the prompt tells the
 * model to "include all items" from an observation while also capping the
 * response at 0-5 bullet points / 700 characters, so an uncapped list of
 * spikes (possible on a long, volatile history) would ask the model to
 * satisfy two contradictory constraints at once.
 */
const MAX_SPIKES = 10;

export function buildHistoryPromptData(args: {
    insights: TrendInsights;
    pointCount: number;
}): HistoryPromptData {
    const { insights, pointCount } = args;

    const observations: HistoryPromptData['observations'] = {
        trendClassification: insights.classification,
        sampledPointCount: pointCount,
    };

    if (insights.worstWindow) {
        observations.worstWindow = {
            commit: insights.worstWindow.commit.sha.slice(0, 7),
            date: insights.worstWindow.commit.date.slice(0, 10),
            findingCount: insights.worstWindow.value,
        };
    }

    if (insights.spikes.length > 0) {
        observations.spikes = [...insights.spikes]
            .sort((a, b) => b.value - a.value)
            .slice(0, MAX_SPIKES)
            .sort((a, b) => a.index - b.index)
            .map((spike) => ({
                commit: spike.commit.sha.slice(0, 7),
                date: spike.commit.date.slice(0, 10),
                findingCount: spike.value,
            }));
    }

    return { observations };
}
