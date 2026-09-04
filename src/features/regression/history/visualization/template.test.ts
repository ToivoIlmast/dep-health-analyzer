import { HISTORY_STRATEGIES } from '@shared/types';
import type { HistoryPoint } from '../types';
import { buildHistoryHtmlTemplate } from './template';

function makeFinding() {
    return {
        from: 'a.ts',
        to: 'b.ts',
        commonDepth: 1,
        residualDepth: 1,
        commonParent: '',
        relation: 'cross-boundary' as const,
        severity: 'warning' as const,
        interpretation: '',
        reasoning: [],
    };
}

function makePoint(overrides: Partial<HistoryPoint> = {}): HistoryPoint {
    return {
        commit: { sha: 'abc1234', date: '2026-01-01T00:00:00Z', title: 'a commit' },
        scannedFiles: 10,
        modules: 10,
        incremental: null,
        cumulative: null,
        ...overrides,
    };
}

describe('buildHistoryHtmlTemplate', () => {
    it('renders a full HTML document', () => {
        const html = buildHistoryHtmlTemplate({
            points: [makePoint()],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
        });

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<title>Architecture History Report</title>');
    });

    it('includes a table row for every sampled point', () => {
        const html = buildHistoryHtmlTemplate({
            points: [
                makePoint({ commit: { sha: 'first01', date: '2026-01-01T00:00:00Z', title: 'first' } }),
                makePoint({ commit: { sha: 'second2', date: '2026-01-02T00:00:00Z', title: 'second' } }),
            ],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
        });

        expect(html).toContain('first01');
        expect(html).toContain('second2');
    });

    it('only renders the incremental column when strategy is incremental', () => {
        const html = buildHistoryHtmlTemplate({
            points: [makePoint()],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
        });

        expect(html).toContain('<th>Incremental</th>');
        expect(html).not.toContain('<th>Cumulative</th>');
    });

    it('renders both columns when strategy is both', () => {
        const html = buildHistoryHtmlTemplate({
            points: [
                makePoint({
                    incremental: { findings: [makeFinding()] },
                    cumulative: { findings: [makeFinding(), makeFinding()] },
                }),
            ],
            strategy: HISTORY_STRATEGIES.BOTH,
            target: '.',
            baselineRef: 'HEAD~10',
        });

        expect(html).toContain('<th>Incremental</th>');
        expect(html).toContain('<th>Cumulative</th>');
    });

    it('includes a trend summary with the classification', () => {
        const html = buildHistoryHtmlTemplate({
            points: [makePoint(), makePoint({ incremental: { findings: [] } })],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
        });

        expect(html).toContain('Trend Summary');
        expect(html).toContain('Stable');
    });

    it('lists spikes with their commit sha in the trend summary', () => {
        const bigFindings = Array(20).fill(makeFinding());

        const html = buildHistoryHtmlTemplate({
            points: [
                makePoint({ commit: { sha: 'aaa1111', date: '2026-01-01T00:00:00Z', title: 'a' } }),
                makePoint({ incremental: { findings: [] } }),
                makePoint({ incremental: { findings: [] } }),
                makePoint({
                    commit: { sha: 'spikeaaa', date: '2026-01-05T00:00:00Z', title: 'spike' },
                    incremental: { findings: bigFindings },
                }),
            ],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
        });

        expect(html).toContain('spikeaa');
    });

    it('escapes an HTML-breaking commit title in the sampled commits table', () => {
        const html = buildHistoryHtmlTemplate({
            points: [
                makePoint({
                    commit: {
                        sha: 'abc1234',
                        date: '2026-01-01T00:00:00Z',
                        title: '<script>alert(1)</script>',
                    },
                }),
            ],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
        });

        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('escapes an HTML-breaking target/baseline ref', () => {
        const html = buildHistoryHtmlTemplate({
            points: [makePoint()],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '<script>alert(2)</script>',
            baselineRef: '<script>alert(3)</script>',
        });

        expect(html).not.toContain('<script>alert(2)</script>');
        expect(html).not.toContain('<script>alert(3)</script>');
    });

    it('embeds the trend chart svg', () => {
        const html = buildHistoryHtmlTemplate({
            points: [makePoint()],
            strategy: HISTORY_STRATEGIES.INCREMENTAL,
            target: '.',
            baselineRef: 'HEAD~10',
        });

        expect(html).toContain('<svg');
        expect(html).toContain('chart-legend');
    });
});
