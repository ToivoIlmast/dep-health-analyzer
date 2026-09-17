export type NodeId = string;

/* export interface DependencyEdge {
    from: NodeId;
    to: NodeId;
} */

export interface DependencyGraph {
    nodes: Set<NodeId>;
    edges: Map<NodeId, Set<NodeId>>;
}

// A relative import specifier (resolveImport()'s own definition of
// "resolvable") that did not map to a real file on disk - a genuine
// analysis gap, not a bare/external specifier (a real npm package or an
// unmatched tsconfig path alias), which resolveImport() already treats as
// an intentional "EXTERNAL SKIP" and is unaffected by this.
export interface UnresolvedImport {
    file: NodeId;
    specifier: string;
}

export interface ScanResult {
    graph: DependencyGraph;
    scannedFiles: number;
    root: string;
    // Optional so every existing hand-built ScanResult value (tests,
    // mocks) stays valid without edits - scanProject() itself always
    // populates a real (possibly empty) array, never omits this.
    unresolvedImports?: UnresolvedImport[];
}
