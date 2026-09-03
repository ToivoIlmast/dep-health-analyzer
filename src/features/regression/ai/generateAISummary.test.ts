import ora from 'ora';
import { generateAISummary } from './generateAISummary';

const mockChat = jest.fn();

jest.mock('ollama', () => ({
    __esModule: true,
    Ollama: jest.fn().mockImplementation((config: { host?: string }) => ({
        __host: config?.host,
        chat: mockChat,
    })),
}));

jest.mock('ora', () => ({
    __esModule: true,
    default: jest.fn(),
}));

class FakeResponseError extends Error {
    constructor(
        message: string,
        public status_code: number
    ) {
        super(message);
        this.name = 'ResponseError';
    }
}

function makeStream(chunks: Array<{ message?: { content?: string }; done?: boolean }>) {
    return {
        abort: jest.fn(),
        [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) {
                yield chunk;
            }
        },
    };
}

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

    it('should connect to the configured host and send the configured chat request', async () => {
        const { Ollama } = jest.requireMock('ollama');
        mockChat.mockResolvedValue(makeStream([{ message: { content: 'Summary' }, done: true }]));

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(Ollama).toHaveBeenCalledWith({ host: 'http://ollama.test' });
        expect(mockChat).toHaveBeenCalledWith({
            model: 'qwen3:14b',
            think: false,
            stream: true,
            messages: [{ role: 'user', content: 'test prompt' }],
        });
    });

    it('should print streamed response content as it arrives', async () => {
        mockChat.mockResolvedValue(
            makeStream([
                { message: { content: 'Summary' } },
                { message: { content: ' complete' }, done: true },
            ])
        );
        const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(spinner.succeed).toHaveBeenCalledWith('AI summary generated');
        expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'Summary');
        expect(stdoutSpy).toHaveBeenNthCalledWith(2, ' complete');

        stdoutSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should fail the summary when Ollama rejects with a response error', async () => {
        mockChat.mockRejectedValue(new FakeResponseError('not found', 404));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(spinner.fail).toHaveBeenCalledWith('AI summary failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Model "qwen3:14b" was not found. Check the model name.'
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('should report a connection error when the request throws a TypeError', async () => {
        mockChat.mockRejectedValue(new TypeError('fetch failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Unable to connect to the Ollama server at')
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('should report an unexpected error when the request throws a non-error value', async () => {
        mockChat.mockRejectedValue('network error');
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

        await generateAISummary({ prompt: 'test prompt', aiConfig });

        expect(consoleErrorSpy).toHaveBeenCalledWith('An unexpected error occurred.');
        expect(exitSpy).toHaveBeenCalledWith(1);

        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });
});
