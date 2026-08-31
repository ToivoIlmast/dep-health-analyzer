import ora from 'ora';
import { generateAISummary } from './generateAISummary';

jest.mock('ora', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('generateAISummary', () => {
    const spinner = {
        start: jest.fn(),
        succeed: jest.fn(),
        fail: jest.fn(),
    };
    const aiConfig = {
        provider: 'ollama' as const,
        host: 'http://ollama.test',
        model: 'qwen3:14b',
        language: 'English',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        spinner.start.mockReturnValue(spinner);
        jest.mocked(ora).mockReturnValue(spinner as unknown as ReturnType<typeof ora>);
    });

    it('should send the configured request and print streamed response content', async () => {
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            body: {
                getReader: () => {
                    const chunks = [
                        new TextEncoder().encode('{"message":{"content":"Summary"}}\n'),
                        new TextEncoder().encode('\n'),
                        new TextEncoder().encode('{"message":{"content":" complete"},"done":true}\n'),
                    ];
                    let index = 0;

                    return {
                        read: jest.fn(async () => {
                            const value = chunks[index++];
                            return value ? { done: false, value } : { done: true, value: undefined };
                        }),
                    };
                },
            },
        } as unknown as Response);
        const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(fetchMock).toHaveBeenCalledWith(
            'http://ollama.test/api/chat',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    model: 'qwen3:14b',
                    think: false,
                    stream: true,
                    messages: [{ role: 'user', content: 'test prompt' }],
                }),
            })
        );
        expect(spinner.succeed).toHaveBeenCalledWith('AI summary generated');
        expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'Summary');
        expect(stdoutSpy).toHaveBeenNthCalledWith(2, ' complete');

        fetchMock.mockRestore();
        stdoutSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should fail the summary when Ollama returns an HTTP error', async () => {
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            status: 404,
        } as Response);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(spinner.fail).toHaveBeenCalledWith('AI summary failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Model "qwen3:14b" was not found. Check the model name.');
        expect(exitSpy).toHaveBeenCalledWith(1);

        fetchMock.mockRestore();
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('should fail the summary when Ollama returns an empty response body', async () => {
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            body: null,
        } as Response);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(spinner.fail).toHaveBeenCalledWith('AI summary failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Response body is empty');
        expect(exitSpy).toHaveBeenCalledWith(1);

        fetchMock.mockRestore();
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('should report a connection error when fetch throws a TypeError', async () => {
        const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('network error'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Unable to connect to the Ollama server at')
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        fetchMock.mockRestore();
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('should report an unexpected error when fetch throws a non-error value', async () => {
        const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue('network error');
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(consoleErrorSpy).toHaveBeenCalledWith('An unexpected error occurred.');
        expect(exitSpy).toHaveBeenCalledWith(1);

        fetchMock.mockRestore();
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });
});
