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

export function resolveRegressionRules(args: ResolveRegressionRulesArgs): EffectiveRegressionRules {
    const { sourcePath, rules, scopes = [] } = args;

    const effective: EffectiveRegressionRules = {
        ignore: false,
        thresholds: { ...rules.thresholds },
        severity: { ...rules.severity },
    };

    const normalizedSourcePath = sourcePath.replaceAll('\\', '/');

    // Applied in config declaration order - a later scope's overrides win
    // over an earlier one's for whatever properties it sets (ignore/
    // thresholds/severity are each only touched by a scope that actually
    // specifies them, so unrelated scopes never clobber each other). This
    // is deterministic by construction: no derived "specificity" measure
    // to get wrong, and no ambiguity for scopes that happen to tie under
    // one. Put broader scopes first and more specific overrides later.
    const matchedScopes = scopes.filter((scope) =>
        minimatch(normalizedSourcePath, scope.match, { nonegate: true })
    );

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
