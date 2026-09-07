import { HISTORY_STRATEGIES, HistoryStrategyType } from '@shared/types';
import { escapeHtml } from '@shared/escapeHtml';
import { styles } from '../../visualization/styles';
import { chartStyles } from './chartStyles';
import { buildTrendChart } from './buildTrendChart';
import { getTrendInsights, TrendClassification } from '../analyze/getTrendInsights';
import { getTrendLabel } from '../analyze/describeTrend';
import { HistoryPoint } from '../types';

/**
 * The banner highlights that the trend is worth a look - a directional
 * change (up, down, or fluctuating) all get the same neutral "notice"
 * styling. "No clear trend" gets the plain/quiet styling instead, since
 * there's nothing to draw attention to. None of these classes assert
 * that the change is architecturally good or bad - only whether it's a
 * notable change at all.
 */
const CLASSIFICATION_BANNER_CLASS: Record<TrendClassification, string> = {
    stabilizing: 'trend-notice',
    worsening: 'trend-notice',
    volatile: 'trend-notice',
    stable: 'trend-quiet',
};

function buildTrendSummarySection(points: HistoryPoint[]): string {
    const { classification, spikes, worstWindow } = getTrendInsights(points);
    const label = getTrendLabel(classification);
    const bannerClass = CLASSIFICATION_BANNER_CLASS[classification];

    const worstWindowMarkup = worstWindow
        ? `<p>Highest finding count: <strong>${worstWindow.value}</strong> finding(s) at <code>${worstWindow.commit.sha.slice(0, 7)}</code> (${worstWindow.commit.date.slice(0, 10)}).</p>`
        : '';

    const spikesMarkup =
        spikes.length > 0
            ? `<ul>${spikes
                  .map(
                      (spike) =>
                          `<li><code>${spike.commit.sha.slice(0, 7)}</code> (${spike.commit.date.slice(0, 10)}): ${spike.value} finding(s)</li>`
                  )
                  .join('')}</ul>`
            : '<p>No spikes detected.</p>';

    return `
        <h2>Trend Summary</h2>

        <p class="trend-banner ${bannerClass}">
            <strong>${label}</strong>
        </p>

        ${worstWindowMarkup}

        ${spikesMarkup}
    `;
}

type BuildHistoryHtmlTemplateArgs = {
    points: HistoryPoint[];
    strategy: HistoryStrategyType;
    target: string;
    baselineRef: string;
};

export function buildHistoryHtmlTemplate(args: BuildHistoryHtmlTemplateArgs): string {
    const { points, strategy, target, baselineRef } = args;

    const showIncremental = strategy !== HISTORY_STRATEGIES.CUMULATIVE;
    const showCumulative = strategy !== HISTORY_STRATEGIES.INCREMENTAL;

    const labels = points.map((point) => point.commit.sha.slice(0, 7));

    const series = [];
    if (showIncremental) {
        series.push({
            label: 'Incremental (vs. previous point)',
            color: '#f87171',
            values: points.map((point) =>
                point.incremental ? point.incremental.findings.length : null
            ),
        });
    }
    if (showCumulative) {
        series.push({
            label: 'Cumulative (vs. first point)',
            color: '#60a5fa',
            values: points.map((point) => (point.cumulative ? point.cumulative.findings.length : null)),
        });
    }

    const chartMarkup = buildTrendChart({ labels, series });

    const rows = points
        .map((point) => {
            const incrementalCount = point.incremental ? point.incremental.findings.length : '-';
            const cumulativeCount = point.cumulative ? point.cumulative.findings.length : '-';

            return `
            <tr>
                <td>${point.commit.sha.slice(0, 7)}</td>
                <td>${point.commit.date}</td>
                <td>${escapeHtml(point.commit.title)}</td>
                <td>${point.scannedFiles}</td>
                <td>${point.modules}</td>
                ${showIncremental ? `<td>${incrementalCount}</td>` : ''}
                ${showCumulative ? `<td>${cumulativeCount}</td>` : ''}
            </tr>
            `;
        })
        .join('');

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8" />
            <title>Architecture History Report</title>
            <style>
                ${styles}
                ${chartStyles}
            </style>
        </head>

        <body>
            <h1>Architecture History Report</h1>

            <div class="section" id="baselineInformationSection">
                <p><strong>Target:</strong> ${escapeHtml(target)}</p>
                <p><strong>Baseline:</strong> ${escapeHtml(baselineRef)}</p>
                <p><strong>Sampled points:</strong> ${points.length}</p>
                <p><strong>Strategy:</strong> ${strategy}</p>
            </div>

            <div class="section" id="trendSummarySection">
                ${buildTrendSummarySection(points)}
            </div>

            <div class="section" id="trendChartSection">
                <h2>Findings Over Time</h2>
                ${chartMarkup}
            </div>

            <h2>Sampled Commits</h2>

            <table>
                <thead>
                    <tr>
                        <th>Commit</th>
                        <th>Date</th>
                        <th>Title</th>
                        <th>Files</th>
                        <th>Modules</th>
                        ${showIncremental ? '<th>Incremental</th>' : ''}
                        ${showCumulative ? '<th>Cumulative</th>' : ''}
                    </tr>
                </thead>

                <tbody>
                    ${rows}
                </tbody>
            </table>
        </body>
        </html>
    `;
}
