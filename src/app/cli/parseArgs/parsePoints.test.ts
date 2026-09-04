import * as printHelpModule from '../printHelp';
import { parsePoints, MIN_HISTORY_POINTS } from './parsePoints';

describe('parsePoints', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    function expectExitWith(args: string[]): void {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const printHelpSpy = jest.spyOn(printHelpModule, 'printHelp').mockImplementation();
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        parsePoints(args, 10);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(printHelpSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(1);
    }

    it('returns the default when --points is not provided', () => {
        expect(parsePoints([], 10)).toBe(10);
    });

    it('returns the parsed integer when a valid value is provided', () => {
        expect(parsePoints(['--points', '5'], 10)).toBe(5);
    });

    it('accepts exactly the minimum (2)', () => {
        expect(parsePoints(['--points', '2'], 10)).toBe(MIN_HISTORY_POINTS);
    });

    it('rejects 1 - a single point can never produce a comparison', () => {
        expectExitWith(['--points', '1']);
    });

    it('rejects 0', () => {
        expectExitWith(['--points', '0']);
    });

    it('rejects a negative number', () => {
        expectExitWith(['--points', '-5']);
    });

    it('rejects letters', () => {
        expectExitWith(['--points', 'abc']);
    });

    it('rejects special characters', () => {
        expectExitWith(['--points', '5;rm -rf']);
    });

    it('rejects a decimal / non-integer value', () => {
        expectExitWith(['--points', '2.5']);
    });

    it('rejects an empty string', () => {
        expectExitWith(['--points', '']);
    });

    it('rejects a value so large it overflows to Infinity', () => {
        expectExitWith(['--points', '1e400']);
    });

    it('accepts a very large but finite integer without crashing', () => {
        expect(parsePoints(['--points', '1000000'], 10)).toBe(1000000);
    });
});
