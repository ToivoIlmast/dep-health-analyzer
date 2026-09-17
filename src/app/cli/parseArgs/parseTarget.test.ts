import * as printHelpModule from '../printHelp';
import { parseTarget } from './parseTarget';

describe('parseTarget (F16)', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return the default target when --target is not provided at all', () => {
        expect(parseTarget([])).toBe('.');
    });

    it('should return the given target', () => {
        expect(parseTarget(['--target', './src'])).toBe('./src');
    });

    it('should not swallow a later flag when --target has a normal value in front of it', () => {
        expect(parseTarget(['--target', './src', '--mode', 'html'])).toBe('./src');
    });

    // F16: `--target` is PRESENT but has no usable value - distinct from
    // --target being omitted entirely (which legitimately means "scan the
    // current directory", tested above). Must be a controlled error, not
    // target === undefined with silent continuation, and not a silent
    // fallback to the current directory either - those would hide a real
    // user mistake (e.g. a forgotten path) behind a normal-looking scan of
    // the wrong directory.
    describe('missing value (F16)', () => {
        it('should print help and exit when --target is followed by another long option', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const printHelpSpy = jest.spyOn(printHelpModule, 'printHelp').mockImplementation();
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

            parseTarget(['--target', '--mode', 'html']);

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(printHelpSpy).toHaveBeenCalled();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should print help and exit when --target is followed by an unknown short option', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const printHelpSpy = jest.spyOn(printHelpModule, 'printHelp').mockImplementation();
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

            parseTarget(['--target', '-x']);

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(printHelpSpy).toHaveBeenCalled();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('should print help and exit when --target is the very last token', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const printHelpSpy = jest.spyOn(printHelpModule, 'printHelp').mockImplementation();
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

            parseTarget(['--target']);

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(printHelpSpy).toHaveBeenCalled();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });
});
