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

    // F19: cycles has no use for a baseline at all (it never diffs two
    // scans) - resolveBaselineRef() must not run for it. Before this fix
    // it ran unconditionally for every non-history command, which is
    // exactly why a plain `cycles` run could print a Git baseline note
    // ("HEAD~1 could not be resolved...") that has nothing to do with what
    // the user asked for.
    describe('cycles does not resolve a baseline (F19)', () => {
        it('does not call resolveBaselineRef for the cycles command', () => {
            setArgv('cycles');
            mockedParseCommand.mockReturnValue(CLI_COMMANDS.CYCLES);

            parseArgs({});

            expect(mockedResolveBaselineRef).not.toHaveBeenCalled();
        });

        it('does not include a baselineRef property for the cycles command', () => {
            setArgv('cycles');
            mockedParseCommand.mockReturnValue(CLI_COMMANDS.CYCLES);

            const result = parseArgs({});

            expect(result).not.toHaveProperty('baselineRef');
        });

        it('still calls resolveBaselineRef for the regression command (unchanged)', () => {
            setArgv('regression');
            mockedParseCommand.mockReturnValue(CLI_COMMANDS.REGRESSION);

            const result = parseArgs({});

            expect(mockedResolveBaselineRef).toHaveBeenCalledWith(undefined);
            expect(result).toHaveProperty('baselineRef', 'HEAD~1');
        });

        it('still calls resolveBaselineRef for the history command (unchanged)', () => {
            setArgv('history');
            mockedParseCommand.mockReturnValue(CLI_COMMANDS.HISTORY);

            const result = parseArgs({});

            expect(mockedResolveBaselineRef).toHaveBeenCalledWith(undefined, 'HEAD~9');
            expect(result).toHaveProperty('baselineRef', 'HEAD~1');
        });
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

    it('resolves history\'s default baseline sampleSize-1 commits back, not a fixed HEAD~1', () => {
        setArgv('history', '--points', '25');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.HISTORY);

        parseArgs({});

        expect(mockedResolveBaselineRef).toHaveBeenCalledWith(undefined, 'HEAD~24');
    });

    it('still passes an explicit --baseline through for history, ignoring the computed fallback', () => {
        setArgv('history', '--baseline', 'main', '--points', '25');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.HISTORY);

        parseArgs({});

        expect(mockedResolveBaselineRef).toHaveBeenCalledWith('main', 'HEAD~24');
    });

    it('does not pass a history-specific fallback for the regression command', () => {
        setArgv('regression');
        mockedParseCommand.mockReturnValue(CLI_COMMANDS.REGRESSION);

        parseArgs({});

        expect(mockedResolveBaselineRef).toHaveBeenCalledWith(undefined);
    });

    // F16: --target is the one option parseArgs.ts resolves itself
    // (getArgValue/parseTarget are not mocked in this file, unlike every
    // other option above) - so these exercise the real, end-to-end wiring,
    // not just parseTarget's own unit tests.
    describe('--target (F16)', () => {
        it('defaults to "." when --target is omitted entirely', () => {
            setArgv('cycles');
            mockedParseCommand.mockReturnValue(CLI_COMMANDS.CYCLES);

            const result = parseArgs({});

            expect(result.target).toBe('.');
        });

        it('reads a normal --target value', () => {
            setArgv('cycles', '--target', './src');
            mockedParseCommand.mockReturnValue(CLI_COMMANDS.CYCLES);

            const result = parseArgs({});

            expect(result.target).toBe('./src');
        });

        it('does not read the next flag as --target\'s value, and exits with a controlled error instead', () => {
            setArgv('cycles', '--target', '--mode', 'html');
            mockedParseCommand.mockReturnValue(CLI_COMMANDS.CYCLES);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

            const result = parseArgs({});

            expect(result.target).not.toBe('--mode');
            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('exits with a controlled error when --target is the last token, instead of silently defaulting', () => {
            setArgv('cycles', '--target');
            mockedParseCommand.mockReturnValue(CLI_COMMANDS.CYCLES);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

            parseArgs({});

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });
});
