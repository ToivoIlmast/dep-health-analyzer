import { DependencyGraph } from '../graph/types';
import { depthFirstSearch } from './dfs';
import { reverseGraph } from './reverseGraph';

type Graph = Map<string, Set<string>>;

// First DFS: Build Finish Order
function buildFinishOrder(graph: Graph): string[] {
    const visited = new Set<string>();
    const finishOrder: string[] = [];

    for (const node of graph.keys()) {
        if (!visited.has(node)) {
            const reachableRegion: string[] = [];
            depthFirstSearch(node, {
                graph,
                visited,
                result: reachableRegion,
                order: finishOrder,
            });
            // console.log('Reachable Region:', reachableRegion);
        }
    }
    finishOrder.reverse();
    // console.log('Finish Order:', finishOrder);

    return finishOrder;
}

// Second DFS: Collect SCCs
function collectSCCs(graph: Graph, finishOrder: string[]): string[][] {
    const reversedGraph = reverseGraph(graph);
    const sccVisited = new Set<string>();
    const sccs: string[][] = [];
    for (const node of finishOrder) {
        if (!sccVisited.has(node)) {
            const scc: string[] = [];
            depthFirstSearch(node, {
                graph: reversedGraph,
                visited: sccVisited,
                result: scc,
            });
            // console.log('Strongly Connected Component (SCC):', scc);
            sccs.push(scc);
        }
    }
    return sccs;
}

function algorithmKosaraju(graph: Graph): string[][] {
    const finishOrder = buildFinishOrder(graph);

    return collectSCCs(graph, finishOrder);
}

/* export function findSCCs(graph: Graph): string[][] {
    const sccs = algorithmKosaraju(graph);
    return sccs;
} */

export function findSCCs(graph: DependencyGraph): string[][] {
    const sccs = algorithmKosaraju(graph.edges);
    return sccs;
}
