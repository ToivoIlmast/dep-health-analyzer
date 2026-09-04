export const MODES = {
    FULL: 'full',
    COMPACT: 'compact',
    HTML: 'html',
} as const;

export type ModeType = (typeof MODES)[keyof typeof MODES];

export type SeverityLevel = 'info' | 'warning' | 'error';

export const HISTORY_STRATEGIES = {
    INCREMENTAL: 'incremental',
    CUMULATIVE: 'cumulative',
    BOTH: 'both',
} as const;

export type HistoryStrategyType = (typeof HISTORY_STRATEGIES)[keyof typeof HISTORY_STRATEGIES];

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
