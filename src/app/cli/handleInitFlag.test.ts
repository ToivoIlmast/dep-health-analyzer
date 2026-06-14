import fs from 'node:fs';
import os from 'node:os';
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
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-'));
        jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
        fs.writeFileSync(path.join(tempDir, 'dep-health.config.json'), '{}');
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        handleInitFlag(['--init']);

        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should write defaultConfig to dep-health.config.json', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-'));
        jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        handleInitFlag(['--init']);

        const configPath = path.join(tempDir, 'dep-health.config.json');
        expect(fs.existsSync(configPath)).toBe(true);
        const generatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(generatedConfig).toEqual(defaultConfig);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });
});
