type ChartSeries = {
    label: string;
    color: string;
    values: Array<number | null>;
};

type BuildTrendChartArgs = {
    labels: string[];
    series: ChartSeries[];
};

const WIDTH = 960;
const HEIGHT = 340;
const PADDING_LEFT = 50;
const PADDING_RIGHT = 20;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 70;
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
const GRIDLINES = 4;

function scaleX(index: number, pointCount: number): number {
    if (pointCount <= 1) {
        return PADDING_LEFT + CHART_WIDTH / 2;
    }
    return PADDING_LEFT + (index / (pointCount - 1)) * CHART_WIDTH;
}

function scaleY(value: number, maxValue: number): number {
    if (maxValue === 0) {
        return PADDING_TOP + CHART_HEIGHT;
    }
    return PADDING_TOP + CHART_HEIGHT - (value / maxValue) * CHART_HEIGHT;
}

function buildAxes(labels: string[], maxValue: number): string {
    const gridlines: string[] = [];

    for (let i = 0; i <= GRIDLINES; i++) {
        const value = Math.round((maxValue / GRIDLINES) * i);
        const y = scaleY(value, maxValue);

        gridlines.push(`
            <line x1="${PADDING_LEFT}" y1="${y}" x2="${WIDTH - PADDING_RIGHT}" y2="${y}" class="chart-gridline" />
            <text x="${PADDING_LEFT - 10}" y="${y + 4}" class="chart-axis-label" text-anchor="end">${value}</text>
        `);
    }

    const xLabels = labels
        .map((label, index) => {
            const x = scaleX(index, labels.length);
            return `<text x="${x}" y="${HEIGHT - PADDING_BOTTOM + 20}" class="chart-axis-label" text-anchor="end" transform="rotate(-40 ${x} ${HEIGHT - PADDING_BOTTOM + 20})">${label}</text>`;
        })
        .join('');

    return gridlines.join('') + xLabels;
}

function buildSeries(series: ChartSeries, pointCount: number, maxValue: number): string {
    const definedPoints = series.values
        .map((value, index) => ({ value, index }))
        .filter((point): point is { value: number; index: number } => point.value !== null);

    if (definedPoints.length === 0) {
        return '';
    }

    const polylinePoints = definedPoints
        .map(({ value, index }) => `${scaleX(index, pointCount)},${scaleY(value, maxValue)}`)
        .join(' ');

    const circles = definedPoints
        .map(({ value, index }) => {
            const x = scaleX(index, pointCount);
            const y = scaleY(value, maxValue);
            return `<circle cx="${x}" cy="${y}" r="4" fill="${series.color}"><title>${series.label}: ${value}</title></circle>`;
        })
        .join('');

    return `
        <polyline points="${polylinePoints}" fill="none" stroke="${series.color}" stroke-width="2" />
        ${circles}
    `;
}

function buildLegend(series: ChartSeries[]): string {
    return series
        .map(
            (item) => `
        <div class="chart-legend-item">
            <span class="chart-legend-swatch" style="background:${item.color}"></span>
            ${item.label}
        </div>
    `
        )
        .join('');
}

export function buildTrendChart(args: BuildTrendChartArgs): string {
    const { labels, series } = args;

    const maxValue = Math.max(
        1,
        ...series.flatMap((item) => item.values.filter((value): value is number => value !== null))
    );

    const seriesMarkup = series.map((item) => buildSeries(item, labels.length, maxValue)).join('');
    const axesMarkup = buildAxes(labels, maxValue);

    return `
        <div class="chart-legend">
            ${buildLegend(series)}
        </div>
        <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" class="chart-svg" role="img" aria-label="Architecture history trend chart">
            ${axesMarkup}
            ${seriesMarkup}
        </svg>
    `;
}
