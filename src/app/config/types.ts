import { ModeType } from '@shared/types';

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
