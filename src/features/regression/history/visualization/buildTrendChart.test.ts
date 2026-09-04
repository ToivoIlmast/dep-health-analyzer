import { buildTrendChart } from './buildTrendChart';

describe('buildTrendChart', () => {
    it('renders one polyline point per non-null value in a series', () => {
        const svg = buildTrendChart({
            labels: ['a', 'b', 'c'],
            series: [{ label: 'Incremental', color: '#f87171', values: [null, 5, 10] }],
        });

        expect(svg).toContain('<polyline');
        const circleCount = (svg.match(/<circle/g) ?? []).length;
        expect(circleCount).toBe(2);
    });

    it('skips a series entirely when every value is null', () => {
        const svg = buildTrendChart({
            labels: ['a'],
            series: [{ label: 'Incremental', color: '#f87171', values: [null] }],
        });

        expect(svg).not.toContain('<polyline');
    });

    it('includes an svg element with the axis and legend markup', () => {
        const svg = buildTrendChart({
            labels: ['a', 'b'],
            series: [{ label: 'Cumulative', color: '#60a5fa', values: [null, 7] }],
        });

        expect(svg).toContain('<svg');
        expect(svg).toContain('chart-legend');
        expect(svg).toContain('Cumulative');
    });

    it('renders both series with their own colors when two are provided', () => {
        const svg = buildTrendChart({
            labels: ['a', 'b'],
            series: [
                { label: 'Incremental', color: '#f87171', values: [null, 3] },
                { label: 'Cumulative', color: '#60a5fa', values: [null, 3] },
            ],
        });

        expect(svg).toContain('#f87171');
        expect(svg).toContain('#60a5fa');
    });

    it('does not throw when every series value is zero', () => {
        expect(() =>
            buildTrendChart({
                labels: ['a', 'b'],
                series: [{ label: 'Incremental', color: '#f87171', values: [0, 0] }],
            })
        ).not.toThrow();
    });

    it('includes a tooltip title with the series label and value for each point', () => {
        const svg = buildTrendChart({
            labels: ['a'],
            series: [{ label: 'Incremental', color: '#f87171', values: [42] }],
        });

        expect(svg).toContain('<title>Incremental: 42</title>');
    });
});
