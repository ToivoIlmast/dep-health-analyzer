import { RegressionAIConfig } from './explainRegression';
import { RegressionPromptData } from './types';

interface IBuildRegressionPrompt {
    analyseData: RegressionPromptData;
    aiConfig: RegressionAIConfig;
}

export function buildRegressionPrompt(args: IBuildRegressionPrompt): string {
    const { analyseData, aiConfig } = args;
    
    return `You are generating a human-readable summary for dep-health.

    You must reason completely in secret.
    DO NOT output any <think> tags and DO NOT text your internal reasoning process. 
    Start your response directly with the final output.

    Analysis data
    
    ${JSON.stringify(analyseData, null, 2)}
    
    Data format
    
    The "observations" object contains all available observations.
    
    Source of truth
    
    The ONLY source of report content is:
    
    observations
    
    If information is not inside observations,
    it MUST NOT appear in the report.
    
    Observation meanings
    
    - primaryAreas: project areas containing the largest concentration of newly introduced dependencies.
    - topHotspots: files with the largest number of newly introduced dependencies.
    - areasConnectedByNewDependencies: structural areas connected through newly introduced dependencies.
    - deepInternalSources: files that introduced new deep-internal dependencies.
    
    Terminology
    
    For "deepInternalSources" term always use the exact phrase:
    
    "deep-internal dependencies"
    
    Do not translate, modify, shorten, or replace "deep-internal dependencies".
    
    Task
    
    Explain the dep-health results to a developer.
    
    Describe only observation types present inside observations.
    
    Only describe the observation types that are present.
    
    If an observation type is missing, omit it completely.
    
    If an observation contains multiple items, include all items.
    
    Describe observations in a human-readable way.
    
    File paths
    
    When a file path is present:
    
    - keep the full path unchanged;
    - do not shorten paths;
    - do not remove directories;
    - do not replace paths with file names.
    
    Strict rules
    
    - ONLY use data from observations.
    - ONLY describe observations present in observations.
    - Do not reinterpret one observation type as another.
    - Each observation type may only be described using its own meaning.
    - Include all items from present observations.
    - Keep descriptions concise.
    
    Never:
    
    - invent facts;
    - speculate;
    - infer impact;
    - infer risk;
    - infer architectural consequences;
    - explain why changes happened;
    - evaluate architecture quality;
    - recommend refactorings;
    - calculate statistics;
    - derive additional metrics;
    - calculate totals;
    - combine values from multiple items;
    - compare counts unless explicitly present in the data;
    - invent additional conclusions;
    - describe dep-health itself;
    - describe the analysis process;
    - summarize instructions;
    - summarize this prompt;
    - describe missing observations;
    - state that information is missing;
    - state that data is unavailable;
    - state that something was not found;
    - mention observations that are not present.
    
    Response format
    
    # AI Summary
    
    Use 0-5 bullet points.
    
    Requirements
    
    - Entire response must be written in ${aiConfig?.language}.
    - Keep file paths unchanged.
    - Maximum 700 characters.
    - Use simple language.`.trim();
}
