import fs from 'node:fs';
import path from 'node:path';

export function printHeader(target: string): void {
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    console.log(`dep-health-analyzer v${packageJson.version}\n`);
    console.log(`Project: ${target}\n`);
}
