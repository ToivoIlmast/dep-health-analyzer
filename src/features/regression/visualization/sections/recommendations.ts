import { escapeHtml } from '@shared/escapeHtml';

type RecommendationsArgs = {
    crossBoundaryCount: number;
    deepInternalCount: number;
    mostAffectedArea: string;
    mostAffectedAreaCount: number;
};

export function recommendations(args: RecommendationsArgs): string {
    const { crossBoundaryCount, deepInternalCount, mostAffectedArea, mostAffectedAreaCount } = args;

    const items: string[] = [];

    if (crossBoundaryCount > 0) {
        items.push(`
            ${crossBoundaryCount} cross-boundary ${crossBoundaryCount === 1 ? 'dependency was' : 'dependencies were'} introduced in this change.
        `);
    }

    if (deepInternalCount > 0) {
        items.push(`
            ${deepInternalCount} deep-internal ${deepInternalCount === 1 ? 'dependency reaches' : 'dependencies reach'} beyond a typical shallow entry point.
        `);
    }

    items.push(`
        Most affected area:
        <strong>${escapeHtml(mostAffectedArea)}</strong>
        (${mostAffectedAreaCount} findings).
    `);

    return `
        <h2>Findings Detail</h2>

        <ul>
            ${items.map((item) => `<li>${item}</li>`).join('')}
        </ul>
    `;
}
