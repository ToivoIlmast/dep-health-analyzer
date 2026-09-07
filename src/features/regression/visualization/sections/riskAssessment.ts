import { CrossBoundaryConcentration } from '../types';

type RiskAssessmentType = {
    concentration: CrossBoundaryConcentration;
    crossBoundaryCount: number;
};

export function riskAssessment(args: RiskAssessmentType): string {
    const { concentration, crossBoundaryCount } = args;

    const concentrationClasses: Record<CrossBoundaryConcentration, string> = {
        'Low Cross-Boundary Concentration': 'concentration-low',
        'Moderate Cross-Boundary Concentration': 'concentration-moderate',
        'High Cross-Boundary Concentration': 'concentration-high',
    };

    const concentrationClass = concentrationClasses[concentration];

    return `
        <h2>Cross-Boundary Concentration</h2>

        <p class="concentration-banner ${concentrationClass}">
            <strong>${concentration}</strong>
        </p>

        <p>
            ${crossBoundaryCount} cross-boundary dependencies detected.
        </p>

        <p>
            This measures the share of this change's findings classified
            as cross-boundary - a structural heuristic, not a verified
            architectural evaluation. Review alongside project-specific
            architecture context.
        </p>

        <p>
            <a
                class="doc-link"
                href="https://github.com/ToivoIlmast/dep-health-analyzer/blob/master/docs/CONFIGURATION.md#cross-boundary-concentration-html-report"
                target="_blank"
                rel="noopener noreferrer"
            >
                How is this calculated?
            </a>
        </p>
    `;
}
