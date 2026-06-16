import { ModeType } from '@shared/types';

export type SeverityLevel = 'info' | 'warning' | 'error';

export interface IRegressionScope {
    /**
     * Source file glob pattern.
     * Example:
     * src/features/**
     */
    match: string;

    /**
     * Ignore regression findings originating
     * from this scope.
     */
    ignore?: boolean;

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
}

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
}
