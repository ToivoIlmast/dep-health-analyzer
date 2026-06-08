type RegressionSummaryType = {
    baselineRef: string;
    findingsCount: number;
    crossBoundaryCount: number;
    mostAffectedArea: string;
    currentSnapshot: number;
    baselineSnapshot: number;
};

export function regressionSummary(args: RegressionSummaryType): string {
    const {
        baselineRef,
        findingsCount,
        crossBoundaryCount,
        mostAffectedArea,
        currentSnapshot,
        baselineSnapshot,
    } = args;

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
            Current Snapshot: <strong>${currentSnapshot} module(s)</strong><br />
            Baseline Snapshot: <strong>${baselineSnapshot} module(s)</strong><br />
            Module Delta: <strong>${currentSnapshot - baselineSnapshot}</strong>
        </p>

        <p>
            The most affected area is
            <strong>${mostAffectedArea}</strong>.
        </p>
    `;
}
