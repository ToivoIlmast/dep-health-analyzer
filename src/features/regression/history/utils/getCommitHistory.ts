import { execFileSync } from 'node:child_process';

export type HistoryCommit = {
    sha: string;
    date: string;
    title: string;
};

const FIELD_SEPARATOR = '\x1f';
const LOG_FORMAT = `%H${FIELD_SEPARATOR}%cI${FIELD_SEPARATOR}%s`;

function parseLogLine(line: string): HistoryCommit {
    const [sha = '', date = '', ...titleParts] = line.split(FIELD_SEPARATOR);
    return { sha, date, title: titleParts.join(FIELD_SEPARATOR) };
}

function parseLogOutput(output: string): HistoryCommit[] {
    return output
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map(parseLogLine);
}

/**
 * Returns the first-parent commit chain from `baselineRef` to `headRef`
 * (oldest first), including `baselineRef` itself as the first entry.
 *
 * First-parent is used deliberately: it walks the mainline of merge commits
 * instead of also descending into every merged branch, which keeps the
 * history a single, sequential timeline instead of an arbitrarily-ordered
 * commit graph.
 */
export function getCommitHistory(args: { baselineRef: string; headRef?: string }): HistoryCommit[] {
    const { baselineRef, headRef = 'HEAD' } = args;

    const baselineLine = execFileSync(
        'git',
        ['log', '-1', `--format=${LOG_FORMAT}`, baselineRef],
        { encoding: 'utf8' }
    ).trim();
    const baseline = parseLogLine(baselineLine);

    const rangeOutput = execFileSync(
        'git',
        ['log', '--first-parent', `--format=${LOG_FORMAT}`, `${baselineRef}..${headRef}`],
        { encoding: 'utf8' }
    );
    // git log lists newest-first; reverse to walk oldest -> newest.
    const descendants = parseLogOutput(rangeOutput).reverse();

    return [baseline, ...descendants];
}
