import { CLI_COMMANDS } from '../types';
import { HISTORY_STRATEGIES, MODES } from '@shared/types';

jest.mock('./parseCommand', () => ({ parseCommand: jest.fn() }));
jest.mock('./parseMode', () => ({ parseMode: jest.fn() }));
jest.mock('./parseHistoryStrategy', () => ({ parseHistoryStrategy: jest.fn() }));
jest.mock('./resolveBaselineRef', () => ({ resolveBaselineRef: jest.fn() }));
jest.mock('./parseAI', () => ({ parseAI: jest.fn() }));

import { parseCommand } from './parseCommand';
import { parseMode } from './parseMode';
import { parseHistoryStrategy } from './parseHistoryStrategy';
import { resolveBaselineRef } from './resolveBaselineRef';
import { parseAI } from './parseAI';
import { parseArgs } from './parseArgs';

const mockedParseCommand = jest.mocked(parseCommand);
const mockedParseMode = jest.mocked(parseMode);
const mockedParseHistoryStrategy = jest.mocked(parseHistoryStrategy);
const mockedResolveBaselineRef = jest.mocked(resolveBaselineRef);
const mockedParseAI = jest.mocked(parseAI);

const originalArgv = process.argv;

function setArgv(...args: string[]): void {
    process.argv = ['node', 'cli.js', ...args];
}

describe('parseArgs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedParseMode.mockReturnValue(MODES.COMPACT);
        mockedParseHistoryStrategy.mockReturnValue(HISTORY_STRATEGIES.INCREMENTAL);
        mockedResolveBaselineRef.mockReturnValue('HEAD~1');
        mockedParseAI.mockReturnValue(false);
    });

    afterEach(() => {
        process.argv = originalArgv;
    });

    it('does not include history-only fields for the cycles command', () => {
        setArgv('cycles');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.CYCLES);

        const result = parseArgs({});

        expect(result).not.toHaveProperty('sampleSize');
        expect(result).not.toHaveProperty('strategy');
    });

    it('does not include sampleSize/strategy for the regression command', () => {
        setArgv('regression');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.REGRESSION);

        const result = parseArgs({});

        expect(result).not.toHaveProperty('sampleSize');
        expect(result).not.toHaveProperty('strategy');
    });

    it('includes sampleSize and strategy for the history command', () => {
        setArgv('history');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.HISTORY);

        const result = parseArgs({});

        expect(result).toMatchObject({
            command: CLI_COMMANDS.HISTORY,
            sampleSize: 10,
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
        });
    });

    it('reads sampleSize from --points when provided', () => {
        setArgv('history', '--points', '25');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.HISTORY);

        const result = parseArgs({});

        expect(result).toMatchObject({ sampleSize: 25 });
    });

    it('falls back to the configured history sampleSize when --points is absent', () => {
        setArgv('history');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.HISTORY);

        const result = parseArgs({
            features: { regression: { history: { sampleSize: 42 } } },
        });

        expect(result).toMatchObject({ sampleSize: 42 });
    });

    it('defaults the history mode to compact from config, not full', () => {
        setArgv('history');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.HISTORY);

        parseArgs({ features: { regression: { history: { mode: MODES.FULL } } } });

        expect(mockedParseMode).toHaveBeenCalledWith(expect.anything(), MODES.FULL);
    });
});
