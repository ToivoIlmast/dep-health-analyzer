import { RegressionAIConfig } from '../../ai/types';
import { generateAISummary } from '../../ai/generateAISummary';
import { getTrendInsights } from '../analyze/getTrendInsights';
import { HistoryPoint } from '../types';
import { buildHistoryPrompt } from './buildHistoryPrompt';
import { buildHistoryPromptData } from './buildHistoryPromptData';

export type ExplainHistoryType = {
    data: { points: HistoryPoint[] };
    aiConfig: RegressionAIConfig;
};

export async function explainHistory(args: ExplainHistoryType): Promise<void | string> {
    const { data, aiConfig } = args;

    const insights = getTrendInsights(data.points);
    const promptData = buildHistoryPromptData({ insights, pointCount: data.points.length });

    const prompt = buildHistoryPrompt({ analyseData: promptData, aiConfig });

    await generateAISummary({ prompt, aiConfig });
}
