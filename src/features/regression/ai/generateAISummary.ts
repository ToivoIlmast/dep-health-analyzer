import ora from 'ora';
import { RegressionAIConfig } from './explainRegression';
import { getAIErrorMessage } from './getAIErrorMessage';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

interface IGenerateAISummary {
    prompt: string;
    aiConfig: RegressionAIConfig;
}

export async function generateAISummary(args: IGenerateAISummary): Promise<void> {
    const { prompt, aiConfig } = args;

    console.log('\nAI Configuration');
    console.log(`Provider: ${aiConfig?.provider}`);
    console.log(`Model:    ${aiConfig?.model}`);
    console.log(`Server:   ${aiConfig?.host}`);

    const started = Date.now();
    const spinner = ora('\nGenerating AI summary...').start();

    try {
        const response = await fetch(`${aiConfig?.host}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: aiConfig?.model,
                think: false,
                stream: true,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
            signal: AbortSignal.timeout(1_200_000), // 20 min
        });

        if (!response.ok) {
            throw new Error(getAIErrorMessage(response.status, aiConfig?.model ?? ''));
        }

        if (!response.body) {
            throw new Error('Response body is empty');
        }

        spinner.succeed('AI summary generated');
        console.log('\nAI response:\n');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, {
                stream: true,
            });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.trim()) {
                    continue;
                }

                try {
                    const chunk = JSON.parse(line);

                    const content = chunk.message?.content;

                    if (content) {
                        process.stdout.write(content);
                    }

                    if (chunk.done) {
                        console.log(
                            `\n\nCompleted in ${((Date.now() - started) / 1000).toFixed(2)}s`
                        );
                    }
                } catch {
                    // ignore incomplete chunk
                }
            }
        }
    } catch (err: unknown) {
        spinner.fail('AI summary failed');

        if (err instanceof TypeError) {
            console.error(
                `Unable to connect to the Ollama server at ${RED}${aiConfig?.host}${RESET}. ` +
                    'Check that the server is running and the host is correct.'
            );
        } else if (err instanceof Error) {
            console.error(err.message);
        } else {
            console.error('An unexpected error occurred.');
        }

        process.exit(1);
    }
}
