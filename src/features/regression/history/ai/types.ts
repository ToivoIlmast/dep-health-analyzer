export interface HistoryPromptData {
    observations: {
        trendClassification?: string;
        sampledPointCount?: number;
        worstWindow?: {
            commit: string;
            date: string;
            findingCount: number;
        };
        spikes?: {
            commit: string;
            date: string;
            findingCount: number;
        }[];
    };
}
