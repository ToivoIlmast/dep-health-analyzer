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
        expect(prompt).toContain('worstWindow');
        expect(prompt).toContain('spikes');
    });
});
