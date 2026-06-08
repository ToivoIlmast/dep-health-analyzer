import { RegressionThresholds, DependencyInsight } from '../../types';
import path from 'node:path';

export function getRelation(args: {
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

export function getInterpretation(relation: DependencyInsight['relation']): string {
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

export function buildReasoning(args: {
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
