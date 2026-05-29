export function heuristicsExplanation(): string {
    return `
        <h2>Heuristics explanation</h2>
                
        <p>
            <strong>Common Depth</strong><br />
            Number of shared path segments between modules.
        </p>

        <p>
            <strong>Residual Depth</strong><br />
            Structural distance after path divergence.
        </p>

        <p>
            <strong>Common Parent</strong><br />
            Shared structural area detected between modules.
        </p>
    `;
}
