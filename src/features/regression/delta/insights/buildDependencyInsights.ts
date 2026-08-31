import { IRegressionScope } from '@shared/types';
import { DependencyDelta, DependencyInsight } from '../../types';
import { getCommonDepth } from '../getCommonDepth';
import { getCommonParent, getResidualDepth } from './pathMetrics';
import { buildReasoning, getInterpretation, getRelation } from './relationClassifier';
import { resolveRegressionRules } from './resolveRegressionRules';

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
    rules: RegressionRules,
    scopes: IRegressionScope[] = []
): DependencyInsight[] {
    const findings: DependencyInsight[] = [];

    for (const dep of delta.added) {
        const effectiveRules = resolveRegressionRules({
            sourcePath: dep.from,
            rules,
            scopes,
        });

        if (effectiveRules.ignore) {
            continue;
        }

        const commonDepth = getCommonDepth(dep.from, dep.to);

        const residualDepth = getResidualDepth(dep.from, dep.to, commonDepth);

        const commonParent = getCommonParent(dep.from, dep.to);

        const relation = getRelation({
            from: dep.from,
            to: dep.to,
            commonDepth,
            residualDepth,
            thresholds: effectiveRules.thresholds,
        });

        const severity = effectiveRules.severity[relation];

        const reasoning = buildReasoning({
            relation,
            commonDepth,
            residualDepth,
            commonParent,
        });

        findings.push({
            from: dep.from,
            to: dep.to,
            commonDepth,
            residualDepth,
            commonParent,
            relation,
            severity,
            interpretation: getInterpretation(relation),
            reasoning,
        });
    }

    return findings;
}
