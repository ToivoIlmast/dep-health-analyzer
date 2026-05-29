type RegressionSummaryType = {
    baselineRef: string;
    findingsCount: number;
    crossBoundaryCount: number;
    mostAffectedArea: string;
};

export function regressionSummary(args: RegressionSummaryType): string {
    const { baselineRef, findingsCount, crossBoundaryCount, mostAffectedArea } = args;

    return `
        <h2>Summary</h2>

        <p>
            Compared to <strong>${baselineRef}</strong>,
            dep-health detected
            <strong>${findingsCount}</strong>
            new architectural findings,
            including
            <strong>${crossBoundaryCount}</strong>
            cross-boundary dependencies.
        </p>

        <p>
            The most affected area is
            <strong>${mostAffectedArea}</strong>.
        </p>
    `;
}
