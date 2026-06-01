import fs from 'node:fs';
import { handleVersionFlag } from './handleVersionFlag';

describe('handleVersionFlag', () => {
    const version = '0.3.0';

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should do nothing when version flag is not provided', () => {
        const readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        handleVersionFlag([]);

        expect(readFileSyncSpy).not.toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should print version and exit when --version is provided', () => {
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ version }));
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        handleVersionFlag(['--version']);

        expect(consoleLogSpy).toHaveBeenCalledWith(`dep-health-analyzer v${version}`);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should print version and exit when -v is provided', () => {
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ version }));
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        handleVersionFlag(['-v']);

        expect(consoleLogSpy).toHaveBeenCalledWith(`dep-health-analyzer v${version}`);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });
});
