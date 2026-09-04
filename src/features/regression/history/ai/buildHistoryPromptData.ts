import { TrendInsights } from '../analyze/getTrendInsights';
import { HistoryPromptData } from './types';

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
        observations.spikes = insights.spikes.map((spike) => ({
            commit: spike.commit.sha.slice(0, 7),
            date: spike.commit.date.slice(0, 10),
            findingCount: spike.value,
        }));
    }

    return { observations };
}
