import { printHelp } from './printHelp';
import { handleHelpFlag } from './handleHelpFlag';

jest.mock('./printHelp');

describe('handleHelpFlag', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should do nothing when help flag is not provided', () => {
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        handleHelpFlag([]);

        expect(printHelp).not.toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should print help and exit when --help is provided', () => {
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        handleHelpFlag(['--help']);

        expect(printHelp).toHaveBeenCalledTimes(1);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });
});
