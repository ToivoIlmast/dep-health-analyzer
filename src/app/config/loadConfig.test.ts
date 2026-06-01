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
});
