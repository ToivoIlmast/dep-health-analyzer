import fs from 'node:fs';
import path from 'node:path';
import { CLI_FLAG } from './types';
import { defaultConfig } from '../config/defaultConfig';

export function handleInitFlag(): void {
    const args = process.argv.slice(2);

    if (!args.includes(CLI_FLAG.INIT)) {
        return;
    }

    const configPath = path.resolve(process.cwd(), 'dep-health.config.json');

    if (fs.existsSync(configPath)) {
        console.warn('dep-health.config.json already exists.');
        process.exit(0);
    }

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4));

    console.log('dep-health.config.json was generated');

    process.exit(0);
}
