import { riskAssessment } from './riskAssessment';

describe('riskAssessment', () => {
    it('should render the concentration level and cross-boundary count', () => {
        const html = riskAssessment({
            concentration: 'High Cross-Boundary Concentration',
            crossBoundaryCount: 9,
        });

        expect(html).toContain('High Cross-Boundary Concentration');
        expect(html).toContain('concentration-high');
        expect(html).toContain('9 cross-boundary dependencies detected.');
    });

    it('should map each concentration level to its CSS class', () => {
        expect(
            riskAssessment({ concentration: 'Low Cross-Boundary Concentration', crossBoundaryCount: 0 })
        ).toContain('concentration-low');
        expect(
            riskAssessment({
                concentration: 'Moderate Cross-Boundary Concentration',
                crossBoundaryCount: 6,
            })
        ).toContain('concentration-moderate');
    });

    it('should link to the documentation explaining how the concentration is calculated, opening in a new tab', () => {
        const html = riskAssessment({
            concentration: 'Low Cross-Boundary Concentration',
            crossBoundaryCount: 0,
        });

        expect(html).toContain(
            'https://github.com/ToivoIlmast/dep-health-analyzer/blob/master/docs/CONFIGURATION.md#cross-boundary-concentration-html-report'
        );
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
        // Styled explicitly (readable color/size on the report's dark theme)
        // rather than left to the browser's default link styling.
        expect(html).toContain('class="doc-link"');
    });
});
