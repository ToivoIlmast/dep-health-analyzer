import { DependencyInsight } from '../../../types';

export type AggregatedFinding = {
    key: string;
    commonParent: string;
    relation: DependencyInsight['relation'];
    interpretation: string;
    count: number;
    examples: DependencyInsight[];
};
