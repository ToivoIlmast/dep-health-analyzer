import { execSync } from 'node:child_process';
import type { ModelResponse } from 'ollama';
import { validateOllamaAIEnvironment } from './validateAIEnvironment';

jest.mock('node:child_process', () => ({
    execSync: jest.fn(),
}));

const mockList = jest.fn();

jest.mock('ollama', () => ({
    __esModule: true,
    Ollama: jest.fn().mockImplementation((config: { host?: string }) => ({
        __host: config?.host,
        list: mockList,
    })),
}));

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

function mockModel(model: string): ModelResponse {
    return {
        name: model,
        model,
        modified_at: new Date(),
        size: 0,
        digest: '',
        details: {
            parent_model: '',
            format: '',
            family: '',
            families: [],
            parameter_size: '',
            quantization_level: '',
        },
        expires_at: new Date(),
        size_vram: 0,
    };
}

describe('validateOllamaAIEnvironment', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('resolves when Ollama CLI is installed, server is running and model is available', async () => {
        mockedExecSync.mockReturnValue(Buffer.from(''));
        mockList.mockResolvedValue({ models: [mockModel('llama3')] });

        await expect(
            validateOllamaAIEnvironment({ model: 'llama3' })
        ).resolves.toBeUndefined();

        expect(mockedExecSync).toHaveBeenCalledWith('ollama --version', { stdio: 'ignore' });
        expect(mockList).toHaveBeenCalled();
    });

    it('connects using the configured host instead of always defaulting to localhost', async () => {
        const { Ollama } = jest.requireMock('ollama');
        mockedExecSync.mockReturnValue(Buffer.from(''));
        mockList.mockResolvedValue({ models: [mockModel('llama3')] });

        await validateOllamaAIEnvironment({ model: 'llama3', host: 'http://ollama.internal:1234' });

        expect(Ollama).toHaveBeenCalledWith({ host: 'http://ollama.internal:1234' });
    });

    it('logs progress messages on success', async () => {
        mockedExecSync.mockReturnValue(Buffer.from(''));
        mockList.mockResolvedValue({ models: [mockModel('llama3')] });

        await validateOllamaAIEnvironment({ model: 'llama3' });

        expect(consoleLogSpy).toHaveBeenCalledWith('Checking AI environment...\n');
        expect(consoleLogSpy).toHaveBeenCalledWith('✓ Ollama CLI detected');
        expect(consoleLogSpy).toHaveBeenCalledWith('✓ Ollama server is running');
        expect(consoleLogSpy).toHaveBeenCalledWith('✓ Model llama3 found\n');
    });

    it('throws when the configured model is not in the local model list', async () => {
        mockedExecSync.mockReturnValue(Buffer.from(''));
        mockList.mockResolvedValue({ models: [mockModel('qwen3:14b')] });

        await expect(validateOllamaAIEnvironment({ model: 'llama3' })).rejects.toThrow(
            '✗ Model "llama3" not found.\nInstall it with: ollama pull llama3'
        );
    });

    it('throws when Ollama CLI is not installed', async () => {
        mockedExecSync.mockImplementation(() => {
            throw new Error('command not found');
        });

        await expect(validateOllamaAIEnvironment({ model: 'llama3' })).rejects.toThrow(
            '✗ Ollama CLI was not found.\nInstall it from https://ollama.com'
        );

        expect(mockList).not.toHaveBeenCalled();
    });

    it('throws when the Ollama server is not reachable', async () => {
        mockedExecSync.mockReturnValue(Buffer.from(''));
        mockList.mockRejectedValue(new Error('connection refused'));

        await expect(validateOllamaAIEnvironment({ model: 'llama3' })).rejects.toThrow(
            '✗ Unable to connect to the Ollama server.\nStart it with: ollama serve'
        );
    });
});
