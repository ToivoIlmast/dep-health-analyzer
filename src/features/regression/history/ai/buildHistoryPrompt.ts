import { RegressionAIConfig } from '../../ai/types';
import { HistoryPromptData } from './types';

interface IBuildHistoryPrompt {
    analyseData: HistoryPromptData;
    aiConfig: RegressionAIConfig;
}

export function buildHistoryPrompt(args: IBuildHistoryPrompt): string {
    const { analyseData, aiConfig } = args;

    return `You are generating a human-readable summary for dep-health's history command,
    which samples points across a project's Git history and detects how
    architectural regression risk changed over that range.

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

    - trendClassification: "stabilizing" means risk introduced per sampled window dropped over the range; "worsening" means it grew or stayed elevated; "volatile" means no clear direction but high variance; "stable" means little to no risk throughout.
    - sampledPointCount: how many commits were sampled across the analyzed range.
    - worstWindow: the single sampled point with the highest number of findings introduced in that window - not necessarily a "spike" on its own.
    - spikes: sampled points where the findings introduced were unusually high compared to the rest of the range - each has a commit, a date, and a finding count.

    Terminology

    Refer to "trendClassification" values exactly as given (stabilizing / worsening / volatile / stable), do not invent synonyms for them.

    Task

    Explain the dep-health history results to a developer.

    Describe only observation types present inside observations.

    Only describe the observation types that are present.

    If an observation type is missing, omit it completely.

    If spikes contains multiple items, include all items.

    Describe observations in a human-readable way.

    Commit references

    When a commit sha is present, keep it exactly as given (do not shorten or lengthen it).

    Strict rules

    - ONLY use data from observations.
    - ONLY describe observations present in observations.
    - Do not reinterpret one observation type as another.
    - Each observation type may only be described using its own meaning.
    - Include all items from present observations.
    - Keep descriptions concise.

    Never:

    - invent facts;
    - speculate about what code changes caused a spike;
    - infer impact;
    - infer risk beyond the given trendClassification;
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
    - Keep commit shas unchanged.
    - Maximum 700 characters.
    - Use simple language.`.trim();
}
