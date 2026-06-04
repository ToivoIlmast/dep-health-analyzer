export type NodeId = string;

/* export interface DependencyEdge {
    from: NodeId;
    to: NodeId;
} */

export interface DependencyGraph {
    nodes: Set<NodeId>;
    edges: Map<NodeId, Set<NodeId>>;
}

export interface ScanResult {
    graph: DependencyGraph;
    scannedFiles: number;
    root: string;
    cycles?: string[][];
}
