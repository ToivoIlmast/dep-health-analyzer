import fs from 'fs';
import path from 'path';
import { IConfig } from './types';
import validateConfig from './validateConfig.generated';

const CONFIG_NAMES = ['dep-health.config.json', '.dep-healthrc.json'];

function formatValidationErrors(errors: NonNullable<typeof validateConfig.errors>): string {
    return errors
        .map((error) => `  - ${error.instancePath || '(root)'} ${error.message}`)
        .join('\n');
}

export function loadConfig(): IConfig | void {
    for (const fileName of CONFIG_NAMES) {
        const fullPath = path.resolve(process.cwd(), fileName);

        if (!fs.existsSync(fullPath)) {
            continue;
        }

        try {
            const raw = fs.readFileSync(fullPath, 'utf-8');
            const parsed: unknown = JSON.parse(raw);

            if (!validateConfig(parsed)) {
                throw new Error(
                    `Invalid configuration in ${fileName}:\n` +
                        formatValidationErrors(validateConfig.errors ?? [])
                );
            }

            return parsed as IConfig;
        } catch (error) {
            console.error(`Failed to load config: ${fileName}`);
            throw error;
        }
    }
}
