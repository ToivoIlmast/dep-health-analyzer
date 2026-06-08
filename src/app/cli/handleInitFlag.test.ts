import fs from 'node:fs';
import path from 'node:path';
import { handleInitFlag } from './handleInitFlag';
import { defaultConfig } from '../config/defaultConfig';

describe('handleInitFlag', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should do nothing when --init flag is not provided', () => {
        const existsSyncSpy = jest.spyOn(fs, 'existsSync');
        handleInitFlag([]);
        expect(existsSyncSpy).not.toHaveBeenCalled();
    });

    it('should warn and exit when config file already exists', () => {
        jest.spyOn(path, 'resolve').mockReturnValue('dep-health.config.json');
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);

        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        handleInitFlag(['--init']);

        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should write defaultConfig to dep-health.config.json', () => {
        jest.spyOn(path, 'resolve').mockReturnValue('dep-health.config.json');
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        const writeFileSyncSpy = jest
            .spyOn(fs, 'writeFileSync')
            .mockImplementation(() => undefined);

        handleInitFlag(['--init']);

        expect(writeFileSyncSpy).toHaveBeenCalledWith(
            'dep-health.config.json',
            JSON.stringify(defaultConfig, null, 4)
        );
    });
});
