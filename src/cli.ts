#!/usr/bin/env node

import { analyzeRegression } from '@features/regression/index.js';
import { analyzeCycles } from '@features/cycles/analyzeCycles.js';

const commands = ['cycles', 'regression'];

async function main() {
    const args = process.argv.slice(2);
    const isCi = args.includes('--ci');
    const isHtml = args.includes('--html');
    const command = args[0];
    const target = args.find((arg) => !arg.startsWith('--') && arg !== command) ?? '.';
    const baselineRef =
        args.find((arg) => !arg.startsWith('--') && arg !== command && arg !== target) ??
        'origin/master';

    if (!command || !commands.includes(command)) {
        console.log(`
            dep-health-analyzer

            Usage:
            dep-health-analyzer cycles <path>
            dep-health-analyzer regression <branch>
            dep-health-analyzer regression --ci <branch>
            dep-health-analyzer regression --html <branch>

            Example:
            dep-health-analyzer cycles ./src
            dep-health-analyzer regression --ci origin/main
        `);
        process.exit(1);
    }

    console.log(`dep-health-analyzer v0.3.0\n`);
    console.log(`Project: ${target}\n`);

    const results: Array<boolean> = [];
    switch (command) {
        case 'regression': {
            const result = await analyzeRegression({
                target,
                baselineRef,
                ci: isCi,
                html: isHtml,
                failOn: 'warning',
            });
            results.push(!!result);
            break;
        }

        case 'cycles': {
            await analyzeCycles(target);
            break;
        }

        default:
            break;
    }

    const resultsFalse = results.filter((result) => result === false);
    if (resultsFalse.length > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
