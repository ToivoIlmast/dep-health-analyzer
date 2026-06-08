type ArchitecturalHealthSummaryType = {
    deltaLength: number;
    crossBoundaryCount: number;
    siblingCount: number;
    internalCount: number;
    deepInternalCount: number;
    topAreas?: string;
};

export function architecturalHealthSummary(args: ArchitecturalHealthSummaryType) {
    const { crossBoundaryCount, deepInternalCount, deltaLength, internalCount, siblingCount } =
        args;
    return `
        <h2>Architectural Health Summary</h2>

        <p>
            This report contains heuristic architectural signals.
            Findings may indicate increasing coupling,
            architectural drift, or dependency complexity.
        </p>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-value">
                    ${deltaLength}
                </div>

                <div class="summary-label">
                    Total Findings
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-value warning">
                    ${crossBoundaryCount}
                </div>

                <div class="summary-label">
                    Cross-Boundary
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-value info">
                    ${siblingCount}
                </div>

                <div class="summary-label">
                    Sibling
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-value success">
                    ${internalCount}
                </div>

                <div class="summary-label">
                    Internal
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-value deep">
                    ${deepInternalCount}
                </div>

                <div class="summary-label">
                    Deep Internal
                </div>
            </div>
        </div> 
        `;
}
