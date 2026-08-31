import { buildRegressionPrompt } from './buildRegressionPrompt';

describe('buildRegressionPrompt', () => {
    it('should include serialized observations and the configured language', () => {
        const prompt = buildRegressionPrompt({
            analyseData: {
                observations: {
                    topHotspots: [
                        {
                            source: 'src/features/auth/AuthService.ts',
                            dependencyCount: 3,
                        },
                    ],
                },
            },
            aiConfig: {
                provider: 'ollama',
                host: 'http://localhost:11434',
                model: 'qwen3:14b',
                language: 'Russian',
            },
        });

        expect(prompt).toContain('"topHotspots"');
        expect(prompt).toContain('src/features/auth/AuthService.ts');
        expect(prompt).toContain('Entire response must be written in Russian.');
    });

    it('should include constraints limiting the summary to observations', () => {
        const prompt = buildRegressionPrompt({
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
});
