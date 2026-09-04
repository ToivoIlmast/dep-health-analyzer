import * as printHelpModule from '../printHelp';
import { HISTORY_STRATEGIES } from '@shared/types';
import { parseHistoryStrategy } from './parseHistoryStrategy';

describe('parseHistoryStrategy', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return the default strategy when the flag is not provided', () => {
        expect(parseHistoryStrategy([], HISTORY_STRATEGIES.INCREMENTAL)).toBe(
            HISTORY_STRATEGIES.INCREMENTAL
        );
    });

    it('should return the strategy from arguments', () => {
        expect(
            parseHistoryStrategy(['--strategy', HISTORY_STRATEGIES.CUMULATIVE], HISTORY_STRATEGIES.INCREMENTAL)
        ).toBe(HISTORY_STRATEGIES.CUMULATIVE);
    });

    it('should print help and exit when the strategy is invalid', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const printHelpSpy = jest.spyOn(printHelpModule, 'printHelp').mockImplementation();
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        parseHistoryStrategy(['--strategy', 'invalid'], HISTORY_STRATEGIES.INCREMENTAL);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(printHelpSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
