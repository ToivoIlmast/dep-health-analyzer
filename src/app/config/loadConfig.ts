import { ModeType } from '@shared/types';
import fs from 'fs';
import path from 'path';

const CONFIG_NAMES = ['dep-health.config.json', '.dep-healthrc.json'];

export type SeverityLevel = 'info' | 'warning' | 'error';

export interface IConfig {
    features?: {
        regression?: {
            enabled?: boolean;
            mode?: ModeType;
            failOn?: SeverityLevel;
            reporting?: {
                html?: {
                    enabled?: boolean;
                    outputPath?: string;
                };
            };
            severity: {
                'cross-boundary'?: SeverityLevel;
                'deep-internal'?: SeverityLevel;
                sibling?: SeverityLevel;
                internal?: SeverityLevel;
            };
            thresholds: {
                internalDepth?: number;
                deepInternalResidualDepth?: number;
            };
        };

        scc?: {
            enabled?: boolean;
            mode?: ModeType;
            failOn?: SeverityLevel;
            reporting?: {
                html?: {
                    enabled?: boolean;
                    outputPath?: string;
                };
            };
            severity?: SeverityLevel;
            maxSize?: number;
        };
    };
}

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
