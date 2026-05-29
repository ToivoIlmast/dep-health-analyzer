import path from 'node:path';
import { DependencyDelta, DependencyInsight, RegressionThresholds } from '../types';

function normalize(file: string): string[] {
    return file.replaceAll('\\', '/').split('/').filter(Boolean);
}

function getCommonDepth(from: string, to: string): number {
    const fromParts = normalize(from);
    const toParts = normalize(to);

    const minLength = Math.min(fromParts.length, toParts.length);

    let commonDepth = 0;

    for (let i = 0; i < minLength; i++) {
        const fromPart = fromParts[i];
        const toPart = toParts[i];

        if (!fromPart || !toPart) {
            break;
        }

        if (fromPart !== toPart) {
            break;
        }

        commonDepth++;
    }

    return commonDepth;
}

function getCommonParent(from: string, to: string): string {
    const fromParts = normalize(from);
    const toParts = normalize(to);

    const minLength = Math.min(fromParts.length, toParts.length);

    const common: string[] = [];

    for (let i = 0; i < minLength; i++) {
        const fromPart = fromParts[i];
        const toPart = toParts[i];

        if (!fromPart || !toPart) {
            break;
        }

        if (fromPart !== toPart) {
            break;
        }

        common.push(fromPart);
    }

    return common.join('/');
}

function getResidualDepth(from: string, to: string, commonDepth: number): number {
    const toParts = normalize(to);

    // remove filename
    const toDirDepth = toParts.length - 1;

    return Math.max(0, toDirDepth - commonDepth);
}

function getRelation(args: {
    from: string;
    to: string;

    commonDepth: number;
    residualDepth: number;

    thresholds: RegressionThresholds;
}): DependencyInsight['relation'] {
    const { from, to, commonDepth, residualDepth, thresholds } = args;

    const { internalDepth, deepInternalResidualDepth } = thresholds;

    const fromDir = path.dirname(from).replaceAll('\\', '/');

    const toDir = path.dirname(to).replaceAll('\\', '/');

    // src/components/Table.tsx
    // src/components/Button.tsx
    if (fromDir === toDir) {
        return 'sibling';
    }

    // src/features/auth/*
    // src/features/auth/utils/*
    if (commonDepth >= internalDepth && residualDepth <= 1) {
        return 'internal';
    }

    // src/features/auth/*
    // src/features/auth/a/b/c/d/*
    if (commonDepth >= internalDepth && residualDepth >= deepInternalResidualDepth) {
        return 'deep-internal';
    }

    return 'cross-boundary';
}

function getInterpretation(relation: DependencyInsight['relation']): string {
    switch (relation) {
        case 'internal':
            return 'likely internal module dependency';

        case 'deep-internal':
            return 'deep internal dependency traversal';

        case 'sibling':
            return 'likely sibling module dependency';

        case 'cross-boundary':
            return 'possible cross-boundary dependency';
    }
}

function buildReasoning(args: {
    relation: DependencyInsight['relation'];
    commonDepth: number;
    residualDepth: number;
    commonParent: string;
}): string[] {
    const { relation, commonDepth, residualDepth, commonParent } = args;

    const reasoning: string[] = [];
    reasoning.push(`Common Depth = ${commonDepth}`);
    reasoning.push(`Residual Depth = ${residualDepth}`);
    reasoning.push(`Common Parent = ${commonParent}`);

    switch (relation) {
        case 'sibling':
            reasoning.push('same parent directory detected');
            break;

        case 'internal':
            reasoning.push('deep shared structural area detected');
            break;

        case 'deep-internal':
            reasoning.push('deep internal traversal detected');
            break;

        case 'cross-boundary':
            reasoning.push('dependency crosses structural boundary');
            break;
    }

    return reasoning;
}

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
