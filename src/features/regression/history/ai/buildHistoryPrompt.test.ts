import { buildHistoryPrompt } from './buildHistoryPrompt';

describe('buildHistoryPrompt', () => {
    it('should include serialized observations and the configured language', () => {
        const prompt = buildHistoryPrompt({
            analyseData: {
                observations: {
                    trendClassification: 'worsening',
                    sampledPointCount: 10,
                    spikes: [{ commit: 'abc1234', date: '2026-01-01', findingCount: 42 }],
                },
            },
            aiConfig: {
                provider: 'ollama',
                host: 'http://localhost:11434',
                model: 'qwen3:14b',
                language: 'Russian',
            },
        });

        expect(prompt).toContain('"trendClassification": "worsening"');
        expect(prompt).toContain('abc1234');
        expect(prompt).toContain('Entire response must be written in Russian.');
    });

    it('should include constraints limiting the summary to observations', () => {
        const prompt = buildHistoryPrompt({
            analyseData: { observations: {} },
            aiConfig: {
                provider: 'ollama',
                language: 'English',
            },
        });

        expect(prompt).toContain('The ONLY source of report content is:');
        expect(prompt).toContain('observations');
        expect(prompt).toContain('- invent facts;');
        expect(prompt).toContain('Use 0-5 bullet points.');
    });

    it('should explain the meaning of history-specific observation fields', () => {
        const prompt = buildHistoryPrompt({
            analyseData: { observations: {} },
            aiConfig: { provider: 'ollama', language: 'English' },
        });

        expect(prompt).toContain('trendClassification');
        expect(prompt).toContain('peakWindow');
        expect(prompt).toContain('spikes');
    });

    it('never DEFINES trendClassification in terms of "risk", and explicitly forbids reframing a findings-count change as architecture getting better/worse - the direct fix for a real case where the AI said "the risk increased over time" about an architecturally clean, zero-cycle project purely because heuristic findings went up', () => {
        const prompt = buildHistoryPrompt({
            analyseData: { observations: {} },
            aiConfig: { provider: 'ollama', language: 'English' },
        });

        const observationMeaningsLine = prompt
            .split('\n')
            .find((line) => line.includes('trendClassification: compares'));

        expect(observationMeaningsLine).toBeDefined();
        expect(observationMeaningsLine?.toLowerCase()).not.toContain('risk');
        expect(prompt).toContain('Increasing');
        expect(prompt).toContain('Decreasing');
        expect(prompt).toContain(
            'describe an increase or decrease in findings as architecture getting worse or better'
        );
    });

    it('describes trendClassification in terms that actually match classifyTrend() - a flat-but-high series is "No Clear Trend", not "Increasing"', () => {
        // A real inaccuracy an independent audit caught: the prompt used to
        // say "Increasing" means a series "grew OR STAYED ELEVATED" - but
        // classifyTrend() compares the first half's average to the second
        // half's, so a flat-but-high series (e.g. [50,50,50,50]) is "stable"
        // ("No Clear Trend"), never "worsening" ("Increasing"). Likewise
        // "No Clear Trend" used to be defined as "little to no change",
        // which doesn't hold for a genuinely oscillating series that still
        // lands there because its coefficient of variation stays under the
        // volatility threshold.
        const prompt = buildHistoryPrompt({
            analyseData: { observations: {} },
            aiConfig: { provider: 'ollama', language: 'English' },
        });

        const observationMeaningsLine = prompt
            .split('\n')
            .find((line) => line.includes('trendClassification: compares'))!;

        expect(observationMeaningsLine).toBeDefined();
        expect(observationMeaningsLine).not.toContain('grew or stayed elevated');
        expect(observationMeaningsLine).not.toContain('little to no change');
        expect(observationMeaningsLine).toContain('first half');
        expect(observationMeaningsLine).toContain('second half');
        expect(observationMeaningsLine).toContain('30%');
    });
});
