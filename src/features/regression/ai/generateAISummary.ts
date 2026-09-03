import { Ollama } from 'ollama';
import ora from 'ora';
import { RegressionAIConfig } from './types';
import { getAIErrorMessage } from './getAIErrorMessage';

const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const STREAM_TIMEOUT_MS = 1_200_000; // 20 min

interface IGenerateAISummary {
    prompt: string;
    aiConfig: RegressionAIConfig;
}

function hasStatusCode(err: unknown): err is { status_code: number } {
    return (
        typeof err === 'object' &&
        err !== null &&
        'status_code' in err &&
        typeof (err as { status_code: unknown }).status_code === 'number'
    );
}

export async function generateAISummary(args: IGenerateAISummary): Promise<void> {
    const { prompt, aiConfig } = args;

    console.log('\nAI Configuration');
    console.log(`Provider: ${aiConfig?.provider}`);
    console.log(`Model:    ${aiConfig?.model}`);
    console.log(`Server:   ${aiConfig?.host}`);

    const started = Date.now();
    const spinner = ora('\nGenerating AI summary...').start();

    const client = new Ollama({ host: aiConfig?.host });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        const stream = await client.chat({
            model: aiConfig?.model ?? '',
            think: false,
            stream: true,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        timeoutId = setTimeout(() => stream.abort(), STREAM_TIMEOUT_MS);

        spinner.succeed('AI summary generated');
        console.log('\nAI response:\n');

        for await (const chunk of stream) {
            if (chunk.message?.content) {
                process.stdout.write(chunk.message.content);
            }

            if (chunk.done) {
                console.log(`\n\nCompleted in ${((Date.now() - started) / 1000).toFixed(2)}s`);
            }
        }
    } catch (err: unknown) {
        spinner.fail('AI summary failed');

        if (hasStatusCode(err)) {
            console.error(getAIErrorMessage(err.status_code, aiConfig?.model ?? ''));
        } else if (err instanceof TypeError) {
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
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
