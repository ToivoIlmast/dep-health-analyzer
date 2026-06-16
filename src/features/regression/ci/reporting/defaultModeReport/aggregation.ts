import { DependencyInsight } from '../../../types';
import { AggregatedFinding } from './types';

type AggregationType = {
    delta: DependencyInsight[];
};

export function aggregation(arg: AggregationType): AggregatedFinding[] {
    const { delta } = arg;

    const grouped = new Map<string, AggregatedFinding>();

    for (const insight of delta) {
        const key = `${insight.relation}:${insight.commonParent}`;

        const existing = grouped.get(key);

        if (existing) {
            existing.count++;
            existing.examples.push(insight);
            continue;
        }

        grouped.set(key, {
            key,
            commonParent: insight.commonParent,
            relation: insight.relation,
            interpretation: insight.interpretation,
            count: 1,
            examples: [insight],
        });
    }

    const findings = Array.from(grouped.values());

    return findings;
}
