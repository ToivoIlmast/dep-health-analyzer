import { DependencyInsight } from '../types';
import { architecturalHealthSummary } from './sections/architecturalHealthSummary';
import { architecturalRelationGuide } from './sections/architecturalRelationGuide';
import { baselineInformation } from './sections/baselineInformation';
import { disclaimer } from './sections/disclaimer';
import { heuristicsExplanation } from './sections/heuristicsExplanation';
import { recommendations } from './sections/recommendations';
import { regressionSummary } from './sections/regressionSummary';
import { riskAssessment } from './sections/riskAssessment';
import { styles } from './styles';
import { RiskLevel } from './types';

function getRiskLevel(crossBoundaryCount: number): RiskLevel {
    let riskLevel: RiskLevel = 'Low Architectural Risk';
    if (crossBoundaryCount > 20) {
        riskLevel = 'High Architectural Risk';
    } else if (crossBoundaryCount > 10) {
        riskLevel = 'Moderate Architectural Risk';
    }

    return riskLevel;
}

type BuildRegressionHtmlTemplate = {
    delta: DependencyInsight[];
    target: string;
    baselineRef: string;
};

export function buildRegressionHtmlTemplate(args: BuildRegressionHtmlTemplate): string {
    const { delta, target, baselineRef } = args;

    const crossBoundaryCount = delta.filter((item) => item.relation === 'cross-boundary').length;
    const siblingCount = delta.filter((item) => item.relation === 'sibling').length;
    const internalCount = delta.filter((item) => item.relation === 'internal').length;
    const deepInternalCount = delta.filter((item) => item.relation === 'deep-internal').length;
    const areaMap = new Map<string, number>();
    for (const item of delta) {
        areaMap.set(item.commonParent, (areaMap.get(item.commonParent) ?? 0) + 1);
    }
    const topAreas = [...areaMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([area, count]) => `<li>${area} (${count} findings)</li>`)
        .join('');

    const architecturalHealthSummarySection = architecturalHealthSummary({
        deltaLength: delta.length,
        crossBoundaryCount,
        deepInternalCount,
        internalCount,
        siblingCount,
        topAreas,
    });

    const riskLevel = getRiskLevel(crossBoundaryCount);
    const riskAssessmentSection = riskAssessment({
        crossBoundaryCount,
        riskLevel,
    });

    const baselineInformationSection = baselineInformation({ target, baselineRef });

    const sortedAreas = [...areaMap.entries()].sort((a, b) => b[1] - a[1]);

    const [mostAffectedArea, mostAffectedAreaCount] = sortedAreas[0] ?? ['N/A', 0];
    const regressionSummarySection = regressionSummary({
        crossBoundaryCount,
        findingsCount: delta.length,
        mostAffectedArea,
        baselineRef,
    });

    const architecturalRelationGuideSection = architecturalRelationGuide();
    const heuristicsExplanationSection = heuristicsExplanation();
    const disclaimerSection = disclaimer();
    const recommendationsSection = recommendations({
        crossBoundaryCount,
        deepInternalCount,
        mostAffectedArea,
        mostAffectedAreaCount,
    });

    const rows = delta
        .map((item) => {
            const reasoning = item.reasoning.map((reason) => `<li>${reason}</li>`).join('');

            return `
            <tr>
                <td class="${item.relation}">${item.relation}</td>
                <td>${item.interpretation}</td>
                <td>${item.from}</td>
                <td>${item.to}</td>
                <td>${item.commonDepth}</td>
                <td>${item.residualDepth}</td>
                <td>${item.commonParent}</td>
                <td>
                    <ul>
                        ${reasoning}
                    </ul>
                </td>
            </tr>
            `;
        })
        .join('');

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8" />
            <title>Architectural Regression Report</title>
            <style>
                ${styles}
            </style>
        </head>
        
        <body>
            <h1>Architectural Regression Report</h1>
            
            <div class="section" id="baselineInformationSection">
                ${baselineInformationSection}
            </div>

            <div class="section" id="regressionSummarySection">
                ${regressionSummarySection}
            </div>
            
            <div class="section" id="architecturalHealthSummarySection">
                ${architecturalHealthSummarySection}   
            </div>
        
            <div class="section" id="riskAssessmentSection">
                ${riskAssessmentSection}
            </div>

            <div class="section" id="recommendationsSection">
                ${recommendationsSection}
            </div>

            <div class="section" id="architecturalRelationGuideSection">
                ${architecturalRelationGuideSection}
            </div>
        
            <div class="section" id="heuristicsExplanationSection">
                ${heuristicsExplanationSection}
            </div>
        
            <div class="section" id="disclaimerSection">
                ${disclaimerSection}
            </div>
        
            <h2>Architectural Findings</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Relation</th>
                        <th>Interpretation</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Common Depth</th>
                        <th>Residual Depth</th>
                        <th>Common Parent</th>
                        <th>Reasoning</th>
                    </tr>
                </thead>
                
                <tbody>
                    ${rows}
                </tbody>
            </table>
            
            </body>
        </html>
        `;
}
