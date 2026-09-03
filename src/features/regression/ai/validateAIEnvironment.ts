import { execSync } from 'node:child_process';
import { Ollama } from 'ollama';

type ValidateOllamaAIEnvironmentArgs = {
    model: string;
    host?: string;
};

export async function validateOllamaAIEnvironment(
    args: ValidateOllamaAIEnvironmentArgs
): Promise<void> {
    const { model, host } = args;

    console.log('Checking AI environment...\n');


    //
    // Ollama installed
    //

    try {
        execSync('ollama --version', {
            stdio: 'ignore',
        });

        console.log('✓ Ollama CLI detected');
    } catch {
        throw new Error('✗ Ollama CLI was not found.\n' + 'Install it from https://ollama.com');
    }

    //
    // Ollama server
    //

    const client = new Ollama({ host });

    let models;

    try {
        const response = await client.list();

        models = response.models;

        console.log('✓ Ollama server is running');
    } catch {
        throw new Error(
            '✗ Unable to connect to the Ollama server.\n' + 'Start it with: ollama serve'
        );
    }

    //
    // Model
    //

    const exists = models.some((item) => item.model === model);

    if (!exists) {
        throw new Error(
            `✗ Model "${model}" not found.\n` + `Install it with: ollama pull ${model}`
        );
    }

    console.log(`✓ Model ${model} found\n`);
}
