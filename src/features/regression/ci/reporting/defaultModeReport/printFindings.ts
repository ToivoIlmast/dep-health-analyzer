import { AggregatedFinding } from './types';

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

export function printFindings(findings: AggregatedFinding[]): void {
    console.log('\nArchitectural Findings:\n');

    if (findings.length === 0) {
        console.log(`${GREEN}No architectural findings detected.${RESET}\n`);
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
