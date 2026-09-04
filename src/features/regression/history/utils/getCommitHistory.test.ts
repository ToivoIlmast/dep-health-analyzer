import { execFileSync } from 'node:child_process';

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));

import { getCommitHistory } from './getCommitHistory';

const mockedExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;

const SEP = '\x1f';

describe('getCommitHistory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('includes the baseline commit as the first entry', () => {
        mockedExecFileSync.mockImplementation((_cmd, args) => {
            const argv = (args as string[]) ?? [];
            if (argv[0] === 'log' && argv[1] === '-1') {
                return `base-sha${SEP}2026-01-01T00:00:00Z${SEP}baseline commit\n`;
            }
            return '';
        });

        const history = getCommitHistory({ baselineRef: 'HEAD~3' });

        expect(history[0]).toEqual({
            sha: 'base-sha',
            date: '2026-01-01T00:00:00Z',
            title: 'baseline commit',
        });
    });

    it('orders descendant commits oldest-first, reversing git log output', () => {
        mockedExecFileSync.mockImplementation((_cmd, args) => {
            const argv = (args as string[]) ?? [];
            if (argv[0] === 'log' && argv[1] === '-1') {
                return `base-sha${SEP}2026-01-01T00:00:00Z${SEP}baseline\n`;
            }
            // git log --first-parent lists newest-first.
            return (
                `c3${SEP}2026-01-04T00:00:00Z${SEP}third\n` +
                `c2${SEP}2026-01-03T00:00:00Z${SEP}second\n` +
                `c1${SEP}2026-01-02T00:00:00Z${SEP}first\n`
            );
        });

        const history = getCommitHistory({ baselineRef: 'HEAD~3' });

        expect(history.map((c) => c.sha)).toEqual(['base-sha', 'c1', 'c2', 'c3']);
    });

    it('passes --first-parent and the baseline..head range to git log', () => {
        mockedExecFileSync.mockReturnValue('');

        getCommitHistory({ baselineRef: 'abc123', headRef: 'my-branch' });

        expect(mockedExecFileSync).toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['--first-parent', 'abc123..my-branch']),
            expect.anything()
        );
    });

    it('defaults headRef to HEAD when not provided', () => {
        mockedExecFileSync.mockReturnValue('');

        getCommitHistory({ baselineRef: 'abc123' });

        expect(mockedExecFileSync).toHaveBeenCalledWith(
            'git',
            expect.arrayContaining(['abc123..HEAD']),
            expect.anything()
        );
    });

    it('returns just the baseline when there are no descendant commits', () => {
        mockedExecFileSync.mockImplementation((_cmd, args) => {
            const argv = (args as string[]) ?? [];
            if (argv[0] === 'log' && argv[1] === '-1') {
                return `base-sha${SEP}2026-01-01T00:00:00Z${SEP}baseline\n`;
            }
            return '';
        });

        const history = getCommitHistory({ baselineRef: 'HEAD' });

        expect(history).toEqual([
            { sha: 'base-sha', date: '2026-01-01T00:00:00Z', title: 'baseline' },
        ]);
    });

    it('preserves colons in commit titles despite the custom field separator', () => {
        mockedExecFileSync.mockImplementation((_cmd, args) => {
            const argv = (args as string[]) ?? [];
            if (argv[0] === 'log' && argv[1] === '-1') {
                return `base-sha${SEP}2026-01-01T00:00:00Z${SEP}fix: something broken\n`;
            }
            return '';
        });

        const history = getCommitHistory({ baselineRef: 'HEAD' });

        expect(history[0]?.title).toBe('fix: something broken');
    });
});
