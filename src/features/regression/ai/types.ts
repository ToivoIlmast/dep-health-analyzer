/* export type RegressionPromptData = {
    summary: {
        total: number;
        crossBoundary: number;
        deepInternal: number;
        sibling: number;
        internal: number;
    };

    patterns: Array<{
        source: string;
        dependencies: number;
        targets: string[];
    }>;

    findings: Array<{
        from: string;
        to: string;
        relation: string;
        severity: string;
        interpretation: string;
    }>;
};
 */

/* export type RegressionPromptData = {
    summary: {
        total: number;
        crossBoundary: number;
        deepInternal: number;
        sibling: number;
        internal: number;
    };

    hotspots: Array<{
        source: string;
        dependencies: number;
    }>;

    importantFindings: Array<{
        from: string;
        to: string;
        relation: string;
    }>;
}; */

export interface RegressionPromptData {
    observations: {
        primaryAreas?: string[];
        topHotspots?: {
            source: string;
            dependencyCount: number;
        }[];
        areasConnectedByNewDependencies?: string[];
        deepInternalSources?: string[];
    };
}
