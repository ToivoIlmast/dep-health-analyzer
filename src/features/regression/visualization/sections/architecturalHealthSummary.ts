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
        <h2>Findings by Relation Type</h2>

        <p>
            This report contains heuristic structural signals, based on
            file-path geometry - not a verified architectural evaluation.
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
                <div class="summary-value count-cross-boundary">
                    ${crossBoundaryCount}
                </div>

                <div class="summary-label">
                    Cross-Boundary
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-value count-sibling">
                    ${siblingCount}
                </div>

                <div class="summary-label">
                    Sibling
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-value count-internal">
                    ${internalCount}
                </div>

                <div class="summary-label">
                    Internal
                </div>
            </div>

            <div class="summary-card">
                <div class="summary-value count-deep-internal">
                    ${deepInternalCount}
                </div>

                <div class="summary-label">
                    Deep Internal
                </div>
            </div>
        </div>
        `;
}
