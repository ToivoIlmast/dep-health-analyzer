import fs from 'fs';
import path from 'path';
import { IConfig } from './types';

const CONFIG_NAMES = ['dep-health.config.json', '.dep-healthrc.json'];

export function loadConfig(): IConfig | void {
    for (const fileName of CONFIG_NAMES) {
        const fullPath = path.resolve(process.cwd(), fileName);

        if (!fs.existsSync(fullPath)) {
            continue;
        }

        try {
            const raw = fs.readFileSync(fullPath, 'utf-8');

            return JSON.parse(raw) as IConfig;
        } catch (error) {
            console.error(`Failed to load config: ${fileName}`);
            throw error;
        }
    }
}
