import { DependencyInsight } from '../types';
import { HistoryCommit } from './utils/getCommitHistory';

export type HistoryPointResult = {
    findings: DependencyInsight[];
};

export type HistoryPoint = {
    commit: HistoryCommit;
    scannedFiles: number;
    modules: number;
    /** Delta against the previous sampled point. `null` for the first point (nothing precedes it). */
    incremental: HistoryPointResult | null;
    /** Delta against the first sampled point. `null` for the first point (it IS the baseline). */
    cumulative: HistoryPointResult | null;
};

export type HistoryWalkResult = {
    points: HistoryPoint[];
};
