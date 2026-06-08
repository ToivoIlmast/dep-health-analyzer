import { parseCommand } from './parseCommand';
import * as printHelpModule from '../printHelp';

describe('parseCommand', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return command when command is valid', () => {
        expect(parseCommand('cycles')).toBe('cycles');
    });

    it('should print help and exit when command is invalid', () => {
        const printHelpSpy = jest.spyOn(printHelpModule, 'printHelp').mockImplementation();

        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        parseCommand('invalid');

        expect(printHelpSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
