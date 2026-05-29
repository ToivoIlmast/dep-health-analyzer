import { RiskLevel } from '../types';

type RiskAssessmentType = {
    riskLevel: RiskLevel;
    crossBoundaryCount: number;
};

export function riskAssessment(args: RiskAssessmentType): string {
    const { riskLevel, crossBoundaryCount } = args;

    const riskClasses: Record<RiskLevel, string> = {
        'Low Architectural Risk': 'risk-low',
        'Moderate Architectural Risk': 'risk-moderate',
        'High Architectural Risk': 'risk-high',
    };

    const riskClass = riskClasses[riskLevel];

    return `
        <h2>Risk Assessment</h2>

        <p class="risk-banner ${riskClass}">
            <strong>${riskLevel}</strong>
        </p>

        <p>
            ${crossBoundaryCount} cross-boundary dependencies detected.
        </p>

        <p>
            Findings are heuristic signals and should be reviewed
            together with project-specific architecture rules.
        </p>
    `;
}
