export type Graph = Map<string, Set<string>>;

export interface ModuleMetrics {
    ca: number;
    ce: number;
    instability: number;
}
