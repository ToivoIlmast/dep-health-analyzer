export type DependencyDelta = {
    added: Array<{ from: string; to: string }>;
    removed: Array<{ from: string; to: string }>;
};

export type DependencyInsight = {
    from: string;
    to: string;
    commonDepth: number;
    residualDepth: number;
    commonParent: string;
    relation: 'internal' | 'sibling' | 'deep-internal' | 'cross-boundary';
    severity: 'info' | 'warning' | 'error';
    interpretation: string;
    reasoning: string[];
};

export type RegressionThresholds = {
    internalDepth: number;
    deepInternalResidualDepth: number;
};
