import { DependencyInsight } from '../../types';

type AggregatedFinding = {
    key: string;
    commonParent: string;
    relation: DependencyInsight['relation'];
    interpretation: string;
    count: number;
    examples: DependencyInsight[];
};

type AggregationType = {
    delta: DependencyInsight[];
};

function aggregation(arg: AggregationType): AggregatedFinding[] {
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

    console.log('\nArchitectural Findings:\n');

    for (const finding of findings) {
        console.log(`• ${finding.interpretation}`);
        console.log(`  Count: ${finding.count}`);
        console.log(`  Area: ${finding.commonParent}`);
        console.log('  Examples:');

        for (const example of finding.examples.slice(0, 3)) {
            console.log(`   - ${example.from}`);
            console.log(`     -> ${example.to}`);
            console.log('     Reasoning:');
            for (const reason of example.reasoning) {
                console.log(`       • ${reason}`);
            }
            console.log('');
        }
        console.log('');
    }

    return findings;
}

type DefaltReportType = {
    isCi: boolean;
    isHtml: boolean;
    delta: DependencyInsight[];
};

export function defaultModeReport(arg: DefaltReportType): void {
    const { isCi, isHtml, delta } = arg;

    if (isCi || isHtml) return;

    aggregation({ delta });
}
