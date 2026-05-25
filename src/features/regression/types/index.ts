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
    interpretation: string;
    reasoning: string[];
};
