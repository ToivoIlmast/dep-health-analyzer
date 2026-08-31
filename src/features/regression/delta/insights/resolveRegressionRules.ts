import { IRegressionScope } from '@shared/types';
import { minimatch } from 'minimatch';

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

export type EffectiveRegressionRules = {
    ignore: boolean;
    thresholds: RegressionRules['thresholds'];
    severity: RegressionRules['severity'];
};

type ResolveRegressionRulesArgs = {
    sourcePath: string;
    rules: RegressionRules;
    scopes?: IRegressionScope[];
};

function getSpecificity(match: string): number {
    return match.length;
}

export function resolveRegressionRules(args: ResolveRegressionRulesArgs): EffectiveRegressionRules {
    const { sourcePath, rules, scopes = [] } = args;

    const effective: EffectiveRegressionRules = {
        ignore: false,
        thresholds: { ...rules.thresholds },
        severity: { ...rules.severity },
    };

    const normalizedSourcePath = sourcePath.replaceAll('\\', '/');

    const matchedScopes = scopes
        .filter((scope) => minimatch(normalizedSourcePath, scope.match))
        .sort((a, b) => getSpecificity(a.match) - getSpecificity(b.match));

    for (const scope of matchedScopes) {
        if (scope.ignore !== undefined) {
            effective.ignore = scope.ignore;
        }

        if (scope.thresholds) {
            effective.thresholds = {
                ...effective.thresholds,
                ...scope.thresholds,
            };
        }

        if (scope.severity) {
            effective.severity = {
                ...effective.severity,
                ...scope.severity,
            };
        }
    }

    return effective;
}
