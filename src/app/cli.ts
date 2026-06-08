#!/usr/bin/env node

import { parseArgs } from './cli/parseArgs/parseArgs';
import { isCommand } from './cli/isCommand';
import { printHeader } from './cli/printHeader';
import { routeCommand } from './cli/routeCommand';
import { handleExit } from './cli/handleExit';
import { loadConfig } from './config/loadConfig';
import { handleVersionFlag } from './cli/handleVersionFlag';
import { handleInitFlag } from './cli/handleInitFlag';
import { handleHelpFlag } from './cli/handleHelpFlag';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function main(): Promise<void> {
    handleVersionFlag(process.argv.slice(2));
    handleInitFlag(process.argv.slice(2));
    handleHelpFlag(process.argv.slice(2));

    const config = loadConfig();
    if (!config) {
        console.error(
            `\n${RED}Configuration file not found.${RESET}\n\n` +
                `Run\n\n${YELLOW}   npx dep-health-analyzer --init${RESET}\n\nto create one.`
        );

        process.exit(1);
    }

    const args = parseArgs(config);

    isCommand(args.command);
    printHeader(args.target);
    const results = await routeCommand(args, config);
    handleExit(results);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
