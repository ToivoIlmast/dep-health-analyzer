import { riskAssessment } from './riskAssessment';

describe('riskAssessment', () => {
    it('should render the risk level and cross-boundary count', () => {
        const html = riskAssessment({
            riskLevel: 'High Architectural Risk',
            crossBoundaryCount: 9,
        });

        expect(html).toContain('High Architectural Risk');
        expect(html).toContain('risk-high');
        expect(html).toContain('9 cross-boundary dependencies detected.');
    });

    it('should map each risk level to its CSS class', () => {
        expect(riskAssessment({ riskLevel: 'Low Architectural Risk', crossBoundaryCount: 0 })).toContain(
            'risk-low'
        );
        expect(
            riskAssessment({ riskLevel: 'Moderate Architectural Risk', crossBoundaryCount: 6 })
        ).toContain('risk-moderate');
    });

    it('should link to the documentation explaining how risk is calculated, opening in a new tab', () => {
        const html = riskAssessment({
            riskLevel: 'Low Architectural Risk',
            crossBoundaryCount: 0,
        });

        expect(html).toContain(
            'https://github.com/ToivoIlmast/dep-health-analyzer/blob/master/docs/CONFIGURATION.md#risk-assessment-html-report'
        );
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
    });
});
