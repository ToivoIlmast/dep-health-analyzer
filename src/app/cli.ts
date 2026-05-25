#!/usr/bin/env node

import { parseArgs } from './cli/parseArgs';
import { validateCommand } from './cli/validateCommand';
import { printHeader } from './cli/printHeader';
import { routeCommand } from './cli/routeCommand';
import { handleExit } from './cli/handleExit';

async function main(): Promise<void> {
    const args = parseArgs();
    validateCommand(args.command);
    printHeader(args.target);
    const results = await routeCommand(args);
    handleExit(results);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
