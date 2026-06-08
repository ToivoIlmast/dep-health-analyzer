import * as printHelpModule from '../printHelp';
import { MODES } from '@shared/types';
import { parseMode } from './parseMode';

describe('parseMode', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return default mode when mode flag is not provided', () => {
        expect(parseMode([], MODES.FULL)).toBe(MODES.FULL);
    });

    it('should return mode from arguments', () => {
        expect(parseMode(['--mode', MODES.COMPACT], MODES.FULL)).toBe(MODES.COMPACT);
    });

    it('should print help and exit when mode is invalid', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const printHelpSpy = jest.spyOn(printHelpModule, 'printHelp').mockImplementation();
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        parseMode(['--mode', 'invalid'], MODES.FULL);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(printHelpSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
