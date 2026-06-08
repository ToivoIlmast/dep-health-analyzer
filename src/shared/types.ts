export const MODES = {
    FULL: 'full',
    COMPACT: 'compact',
    HTML: 'html',
} as const;

export type ModeType = (typeof MODES)[keyof typeof MODES];
