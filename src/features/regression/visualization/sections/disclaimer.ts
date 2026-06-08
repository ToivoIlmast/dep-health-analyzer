export function disclaimer(): string {
    return `
        <h2>Disclaimer</h2>
                
        <p>
            These findings are heuristic-based architectural signals,
            not strict architectural violations.
        </p>

        <p>
            dep-health does not know project-specific architecture rules
            unless explicit boundaries are configured.
        </p>    
    `;
}
