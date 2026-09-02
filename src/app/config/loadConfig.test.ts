import fs from 'fs';
import { loadConfig } from './loadConfig';

describe('loadConfig', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return undefined when no config files exist', () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);

        const readFileSyncSpy = jest.spyOn(fs, 'readFileSync');

        const result = loadConfig();

        expect(result).toBeUndefined();
        expect(readFileSyncSpy).not.toHaveBeenCalled();
    });

    it('should load dep-health.config.json', () => {
        const config = {
            features: {
                scc: {
                    enabled: true,
                },
            },
        };

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));

        expect(loadConfig()).toEqual(config);
    });

    it('should load .dep-healthrc.json when dep-health.config.json does not exist', () => {
        const config = {
            features: {
                scc: {
                    enabled: true,
                },
            },
        };

        jest.spyOn(fs, 'existsSync').mockImplementation((path) =>
            String(path).includes('.dep-healthrc.json')
        );
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));

        expect(loadConfig()).toEqual(config);
    });

    it('should prefer dep-health.config.json over .dep-healthrc.json', () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);

        const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('{}');

        loadConfig();

        expect(readFileSyncSpy).toHaveBeenCalledWith(
            expect.stringContaining('dep-health.config.json'),
            'utf-8'
        );
    });

    it('should throw when config contains invalid json', () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue('{ invalid json');

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        expect(() => loadConfig()).toThrow();
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should load a config using every documented option without error', () => {
        const config = {
            features: {
                regression: {
                    enabled: true,
                    mode: 'compact',
                    failOn: 'warning',
                    reporting: { html: { enabled: true, outputPath: './reports/regression.html' } },
                    ai: {
                        enabled: true,
                        provider: 'ollama',
                        host: 'http://localhost:11434',
                        model: 'qwen3:14b',
                        language: 'en',
                    },
                    severity: {
                        'cross-boundary': 'warning',
                        'deep-internal': 'warning',
                        sibling: 'info',
                        internal: 'info',
                    },
                    thresholds: { internalDepth: 3, deepInternalResidualDepth: 3 },
                    scopes: [{ match: 'src/app/**', ignore: true }],
                },
                scc: {
                    enabled: true,
                    mode: 'compact',
                    failOn: 'error',
                    reporting: { html: { enabled: true, outputPath: './reports/scc.html' } },
                    severity: 'error',
                    maxSize: 10,
                },
            },
        };

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));

        expect(loadConfig()).toEqual(config);
    });

    it('should throw a descriptive error when a field has an invalid enum value', () => {
        const config = { features: { scc: { mode: 'not-a-real-mode' } } };

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));
        jest.spyOn(console, 'error').mockImplementation();

        expect(() => loadConfig()).toThrow(/mode/);
        expect(() => loadConfig()).toThrow(/allowed values/);
    });

    it('should throw when the config contains an unknown property', () => {
        const config = { features: { scc: { thisFieldDoesNotExist: true } } };

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));
        jest.spyOn(console, 'error').mockImplementation();

        expect(() => loadConfig()).toThrow(/additional propert/i);
    });

    it('should throw when a field has the wrong type', () => {
        const config = { features: { scc: { enabled: 'yes' } } };

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));
        jest.spyOn(console, 'error').mockImplementation();

        expect(() => loadConfig()).toThrow(/boolean/);
    });
});
