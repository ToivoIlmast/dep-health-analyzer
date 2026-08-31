import { getAIErrorMessage } from './getAIErrorMessage';

describe('getAIErrorMessage', () => {
    it.each([
        [401, 'Authentication failed. Please sign in to Ollama.'],
        [403, 'Access denied. The selected model may require a different Ollama plan or is unavailable.'],
        [404, 'Model "qwen3:14b" was not found. Check the model name.'],
        [410, 'Model "qwen3:14b" is no longer available. It may have been removed or is no longer supported.'],
        [500, 'The Ollama server returned an internal error.'],
        [503, 'HTTP 503'],
    ])('should return an appropriate message for HTTP %i', (status, expected) => {
        expect(getAIErrorMessage(status, 'qwen3:14b')).toBe(expected);
    });
});
