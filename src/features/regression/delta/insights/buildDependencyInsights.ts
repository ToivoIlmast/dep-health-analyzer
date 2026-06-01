import { DependencyDelta, DependencyInsight } from '../../types';
import { getCommonDepth } from '../getCommonDepth';
import { getCommonParent, getResidualDepth } from './pathMetrics';
import { buildReasoning, getInterpretation, getRelation } from './relationClassifier';

type RegressionRules = {
    thresholds: {
        internalDepth: number;
        deepInternalResidualDepth: number;
    };
    severity: {
        'cross-boundary': 'info' | 'warning' | 'error';
        'deep-internal': 'info' | 'warning' | 'error';
        sibling: 'info' | 'warning' | 'error';
        internal: 'info' | 'warning' | 'error';
    };
};
export function buildDependencyInsights(
    delta: DependencyDelta,
    rules: RegressionRules
): DependencyInsight[] {
    return delta.added.map((dep) => {
        const commonDepth = getCommonDepth(dep.from, dep.to);

        const residualDepth = getResidualDepth(dep.from, dep.to, commonDepth);

        const commonParent = getCommonParent(dep.from, dep.to);

        const relation = getRelation({
            from: dep.from,
            to: dep.to,
            commonDepth,
            residualDepth,
            thresholds: rules.thresholds,
        });

        const severity = rules.severity[relation];

        const reasoning = buildReasoning({
            relation,
            commonDepth,
            residualDepth,
            commonParent,
        });

        return {
            from: dep.from,
            to: dep.to,
            commonDepth,
            residualDepth,
            commonParent,
            relation,
            severity,
            interpretation: getInterpretation(relation),
            reasoning,
        };
    });
}
