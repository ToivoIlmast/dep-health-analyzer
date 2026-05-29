import fs from 'node:fs';
import path from 'node:path';
import { CLI_FLAG } from './types';

export function handleVersionFlag(): void {
    if (
        !process.argv.slice(2).includes(CLI_FLAG.VERSION) &&
        !process.argv.slice(2).includes(CLI_FLAG.VERSION_SHORT)
    ) {
        return;
    }
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    console.log(`dep-health-analyzer v${packageJson.version}`);

    process.exit(0);
}
