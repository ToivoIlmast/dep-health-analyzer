import { IConfig } from 'app/config/types';
import { RegressionAnalysisResult } from '../types';
import { buildRegressionPrompt } from './buildRegressionPrompt';
import { buildRegressionPromptData } from './buildRegressionPromptData';
import { generateAISummary } from './generateAISummary';
import { RegressionPromptData } from './types';

export type RegressionAIConfig = NonNullable<NonNullable<IConfig['features']>['regression']>['ai'];

export type ExplainRegressionType = {
    data: RegressionAnalysisResult;
    aiConfig: RegressionAIConfig;
};

export async function explainRegression(args: ExplainRegressionType): Promise<void | string> {
    const { data, aiConfig } = args;

    const promptData = buildRegressionPromptData(data);

    const prompt = buildRegressionPrompt({ analyseData: promptData, aiConfig });
    if (
        !(promptData as RegressionPromptData).observations ||
        Object.keys((promptData as RegressionPromptData).observations).length === 0
    ) {
        console.log('No observations available for AI summary.');
        return;
    }

    await generateAISummary({ prompt, aiConfig });
}
