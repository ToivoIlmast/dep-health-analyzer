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
            Review ${crossBoundaryCount} cross-boundary dependencies.
            Verify that boundary crossings are intentional and align with project architecture rules.
        `);
    }

    if (deepInternalCount > 0) {
        items.push(`
            Review deep-internal dependencies.
            Consider exposing public APIs instead of importing nested implementation details.
        `);
    }

    items.push(`
        Review findings in the most affected area:
        <strong>${mostAffectedArea}</strong>
        (${mostAffectedAreaCount} findings).
    `);

    return `
        <h2>Suggested Review Actions</h2>

        <ul>
            ${items.map((item) => `<li>${item}</li>`).join('')}
        </ul>
    `;
}
