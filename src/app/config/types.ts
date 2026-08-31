/* import { IRegressionScope, ModeType, SeverityLevel } from '@shared/types';

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
            severity?: {
                'cross-boundary'?: SeverityLevel;
                'deep-internal'?: SeverityLevel;
                sibling?: SeverityLevel;
                internal?: SeverityLevel;
            };
            thresholds?: {
                internalDepth?: number;
                deepInternalResidualDepth?: number;
            };

            scopes?: IRegressionScope[];
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
} */

import { ConfigSchema } from './config.types';

export type IConfig = ConfigSchema;
