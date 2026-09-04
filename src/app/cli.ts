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
import { registerSignalHandlers } from './cli/registerSignalHandlers';
import { isExecFileError } from './cli/isExecFileError';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function main(): Promise<void> {
    registerSignalHandlers();

    handleVersionFlag(process.argv.slice(2));
    handleInitFlag(process.argv.slice(2));
    handleHelpFlag(process.argv.slice(2));

    let config;
    try {
        config = loadConfig();
    } catch (err) {
        console.error(`\n${RED}${err instanceof Error ? err.message : 'Failed to load configuration.'}${RESET}`);
        process.exit(1);
    }

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
    if (isExecFileError(err)) {
        // The child process (always git here) already printed its own
        // error to the terminal via stdio: 'inherit' - a full Node stack
        // trace on top of that is noise, not new information.
        console.error(`${RED}\nGit command failed (see output above for details).\n${RESET}`);
        process.exit(1);
    }

    console.error(err);
    process.exit(1);
});
