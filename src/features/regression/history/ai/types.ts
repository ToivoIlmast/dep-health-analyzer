export interface HistoryPromptData {
    observations: {
        trendClassification?: string;
        sampledPointCount?: number;
        // Named "peak", not "worst" - it's the point with the highest
        // finding count, not a judgement that this point was bad.
        peakWindow?: {
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
