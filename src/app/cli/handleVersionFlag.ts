import fs from 'node:fs';
import path from 'node:path';
import { CLI_FLAG } from './types';

export function handleVersionFlag(args: string[] = process.argv.slice(2)): void {
    if (!args.includes(CLI_FLAG.VERSION) && !args.includes(CLI_FLAG.VERSION_SHORT)) {
        return;
    }
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    console.log(`dep-health-analyzer v${packageJson.version}`);

    process.exit(0);
}
