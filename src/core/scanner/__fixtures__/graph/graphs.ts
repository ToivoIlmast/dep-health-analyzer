type Graph = {
    nodes: Set<string>;
    edges: Map<string, Set<string>>;
};

function createGraph(): Graph {
    return {
        nodes: new Set(),
        edges: new Map(),
    };
}

function addEdge(graph: Graph, from: string, to: string): void {
    graph.nodes.add(from);
    graph.nodes.add(to);

    if (!graph.edges.has(from)) {
        graph.edges.set(from, new Set());
    }

    graph.edges.get(from)?.add(to);
}

/*
|--------------------------------------------------------------------------
| Simple SCC graph
|--------------------------------------------------------------------------
*/

export function createSimpleSccGraph(): Graph {
    const graph = createGraph();

    addEdge(graph, 'A', 'B');
    addEdge(graph, 'B', 'C');
    addEdge(graph, 'C', 'A');

    addEdge(graph, 'C', 'D');

    addEdge(graph, 'D', 'E');
    addEdge(graph, 'E', 'F');
    addEdge(graph, 'F', 'D');

    addEdge(graph, 'G', 'H');

    return graph;
}

/*
|--------------------------------------------------------------------------
| Layered architecture graph
|--------------------------------------------------------------------------
*/

export function createLayeredGraph(): Graph {
    const graph = createGraph();

    // UI
    addEdge(graph, 'ui/App', 'ui/Layout');
    addEdge(graph, 'ui/Layout', 'services/AuthService');

    // Services
    addEdge(graph, 'services/AuthService', 'domain/User');
    addEdge(graph, 'services/AuthService', 'infra/ApiClient');

    // Domain
    addEdge(graph, 'domain/User', 'domain/Permissions');

    // Infra
    addEdge(graph, 'infra/ApiClient', 'infra/Http');

    return graph;
}

/*
|--------------------------------------------------------------------------
| Giant SCC graph
|--------------------------------------------------------------------------
*/

export function createGiantSccGraph(): Graph {
    const graph = createGraph();

    for (let i = 1; i <= 12; i++) {
        addEdge(graph, `Module${i}`, `Module${i + 1}`);
    }

    addEdge(graph, 'Module13', 'Module1');

    return graph;
}

/*
|--------------------------------------------------------------------------
| Hub graph
|--------------------------------------------------------------------------
*/

export function createHubGraph(): Graph {
    const graph = createGraph();

    for (let i = 1; i <= 20; i++) {
        addEdge(graph, `Feature${i}`, 'shared/utils');
    }

    return graph;
}

/*
|--------------------------------------------------------------------------
| Multiple isolated SCCs
|--------------------------------------------------------------------------
*/

export function createMultipleSccGraph(): Graph {
    const graph = createGraph();

    // SCC #1
    addEdge(graph, 'A', 'B');
    addEdge(graph, 'B', 'C');
    addEdge(graph, 'C', 'A');

    // SCC #2
    addEdge(graph, 'D', 'E');
    addEdge(graph, 'E', 'F');
    addEdge(graph, 'F', 'D');

    // SCC #3
    addEdge(graph, 'G', 'H');
    addEdge(graph, 'H', 'I');
    addEdge(graph, 'I', 'G');

    // Bridges
    addEdge(graph, 'C', 'D');
    addEdge(graph, 'F', 'G');

    return graph;
}

/*
|--------------------------------------------------------------------------
| Large realistic project graph
|--------------------------------------------------------------------------
*/

export function createRealisticProjectGraph(): Graph {
    const graph = createGraph();

    // Create modules
    for (let i = 1; i <= 100; i++) {
        graph.nodes.add(`Module${i}`);
    }

    // Linear regions
    for (let i = 1; i < 20; i++) {
        addEdge(graph, `Module${i}`, `Module${i + 1}`);
    }

    for (let i = 21; i < 40; i++) {
        addEdge(graph, `Module${i}`, `Module${i + 1}`);
    }

    for (let i = 41; i < 60; i++) {
        addEdge(graph, `Module${i}`, `Module${i + 1}`);
    }

    // SCCs
    addEdge(graph, 'Module5', 'Module8');
    addEdge(graph, 'Module8', 'Module11');
    addEdge(graph, 'Module11', 'Module5');

    addEdge(graph, 'Module25', 'Module27');
    addEdge(graph, 'Module27', 'Module30');
    addEdge(graph, 'Module30', 'Module25');

    addEdge(graph, 'Module45', 'Module47');
    addEdge(graph, 'Module47', 'Module49');
    addEdge(graph, 'Module49', 'Module45');

    // Hubs
    for (let i = 60; i <= 90; i++) {
        addEdge(graph, `Module${i}`, 'Module1');
    }

    // Cross-links
    addEdge(graph, 'Module18', 'Module45');
    addEdge(graph, 'Module55', 'Module12');
    addEdge(graph, 'Module72', 'Module33');

    return graph;
}

export function createRealisticProjectGraphWithFullPaths(): Graph {
    const graph = createGraph();

    function modulePath(domain: string, layer: string, file: string): string {
        return `src/${domain}/${layer}/${file}.ts`;
    }

    const modules: string[] = [];

    function getModule(index: number): string {
        const module = modules[index];

        if (!module) {
            throw new Error(`Module at index ${index} not found`);
        }

        return module;
    }

    // Create modules
    for (let i = 1; i <= 100; i++) {
        let moduleName: string;

        if (i <= 20) {
            moduleName = modulePath('auth', 'services', `service${i}`);
        } else if (i <= 40) {
            moduleName = modulePath('billing', 'repositories', `repository${i}`);
        } else if (i <= 60) {
            moduleName = modulePath('notifications', 'workers', `worker${i}`);
        } else if (i <= 80) {
            moduleName = modulePath('shared', 'utils', `util${i}`);
        } else {
            moduleName = modulePath('api', 'controllers', `controller${i}`);
        }

        modules.push(moduleName);

        graph.nodes.add(moduleName);
    }

    // Linear regions
    for (let i = 0; i < 19; i++) {
        addEdge(graph, getModule(i), getModule(i + 1));
    }

    for (let i = 20; i < 39; i++) {
        addEdge(graph, getModule(i), getModule(i + 1));
    }

    for (let i = 40; i < 59; i++) {
        addEdge(graph, getModule(i), getModule(i + 1));
    }

    // SCCs
    addEdge(graph, getModule(4), getModule(7));
    addEdge(graph, getModule(7), getModule(10));
    addEdge(graph, getModule(10), getModule(4));

    addEdge(graph, getModule(24), getModule(26));
    addEdge(graph, getModule(26), getModule(29));
    addEdge(graph, getModule(29), getModule(24));

    addEdge(graph, getModule(44), getModule(46));
    addEdge(graph, getModule(46), getModule(48));
    addEdge(graph, getModule(48), getModule(44));

    // Hubs
    for (let i = 59; i <= 89; i++) {
        addEdge(graph, getModule(i), getModule(0));
    }

    // Cross-links
    addEdge(graph, getModule(17), getModule(44));
    addEdge(graph, getModule(54), getModule(11));
    addEdge(graph, getModule(71), getModule(32));

    return graph;
}
