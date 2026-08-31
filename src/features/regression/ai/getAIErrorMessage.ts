export function getAIErrorMessage(status: number, model: string): string {
    switch (status) {
        case 401:
            return 'Authentication failed. Please sign in to Ollama.';
        case 403:
            return 'Access denied. The selected model may require a different Ollama plan or is unavailable.';
        case 404:
            return `Model "${model}" was not found. Check the model name.`;

        case 410:
            return `Model "${model}" is no longer available. It may have been removed or is no longer supported.`;

        case 500:
            return 'The Ollama server returned an internal error.';

        default:
            return `HTTP ${status}`;
    }
}
