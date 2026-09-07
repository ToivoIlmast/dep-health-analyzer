import { AggregatedFinding } from './types';

export function printFindings(findings: AggregatedFinding[]): void {
    console.log('\nArchitectural Findings:\n');

    if (findings.length === 0) {
        console.log('No architectural findings detected.\n');
        return;
    }

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
}
