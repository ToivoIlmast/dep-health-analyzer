import path from 'node:path';
import { DependencyGraph } from '@core/graph/types';
import { ModuleMetrics } from '@features/cycles/metrics/types';

export type CytoscapeNode = {
    data: {
        id: string;
        label: string;
        // The real, full, untruncated relative directory - always the
        // canonical value; nothing anywhere abbreviates or overwrites this.
        // The tooltip and the "Selected module" panel are both built from
        // this (and `id`, which is the absolute canonical path), never
        // from `displayDir` below.
        dir: string;
        // A presentation-only abbreviation of `dir`, computed once by
        // computeDisplayDir() below, for what actually gets drawn ON the
        // node - kept as a distinct field rather than overwriting `dir`
        // in place, so nothing that needs the real path ever accidentally
        // reads the shortened one.
        displayDir: string;
        color?: string;
        // The real index into the `sccs` list findSCCs() returned for this
        // scan - the same value already used (mod defaultColors.length) to
        // pick `color` above, just not previously exposed. `color` alone
        // isn't a reliable way to tell two SCCs apart once a project has
        // more simultaneous cycles than defaultColors has entries (colors
        // wrap around); this is the real, non-repeating identifier a
        // frontend "which other modules share this node's cycle" lookup
        // needs instead of re-deriving SCC membership itself. Undefined for
        // any node that isn't part of a real (2+) cycle.
        sccId?: number;
        area: string;
        areaColor: string;
        size?: number;
        ce?: number;
        ca?: number;
        instability?: number;
        sccSize?: number;
    };
    classes?: string;
};

export type CytoscapeEdge = {
    data: {
        source: string;
        target: string;
    };
};

// A qualitative/categorical palette (ColorBrewer's "Dark2" set), not an
// ordinal one - deliberately NOT a red-to-green ramp. `defaultColors[0]`
// being reached first (the first SCC `findSCCs()` happens to return) must
// not read as "the worst cycle" and a later index as "a milder one": which
// index a given SCC gets depends only on iteration order, not on size,
// severity, or how many real problems it represents. Distinguishing
// multiple simultaneous cycles from each other only needs colors humans
// can tell apart, not colors that imply a ranking between them.
const defaultColors = [
    '#1b9e77',
    '#d95f02',
    '#7570b3',
    '#e7298a',
    '#66a61e',
    '#e6ab02',
    '#a6761d',
    '#666666',
];

// Experimental (branch: experiment/cycle-map-v2). Module "areas" replace
// the previous hardcoded core/features/utils/scripts classification - that
// version only ever produced a sensible result for a project that happened
// to use those exact folder names (this one). An area is derived purely
// from a node's own path (see computeModuleArea below), so it's whatever
// top-level structure the ANALYZED project actually has, not a guess at
// what any particular project's folders are supposed to mean.
//
// A qualitative/categorical palette, deliberately separate from
// `defaultColors` above (the SCC/cycle palette) even though both are
// non-ordinal for the same reason - a node that's actually in a cycle
// always shows the SCC color instead (see the '.scc' style rule in
// template.ts, listed after the base 'node' rule so it wins), so the two
// palettes are never visible on the same node at once, but keeping them
// visually distinct avoids a coincidental color match reading as if it
// meant something.
const AREA_PALETTE = [
    '#3b82f6',
    '#22c55e',
    '#a855f7',
    '#f97316',
    '#06b6d4',
    '#eab308',
    '#ec4899',
    '#84cc16',
    '#6366f1',
    '#14b8a6',
    '#f43f5e',
    '#8b5cf6',
    '#0ea5e9',
    '#65a30d',
    '#d946ef',
    '#f59e0b',
] as const;

// djb2 - not for anything cryptographic, just a cheap, stable way to turn
// an arbitrary area name into a number so the same name always lands on
// the same palette index, on every run, without keeping any kind of
// name -> color registry around (which would need to persist somewhere to
// stay stable across separate CLI invocations, and would need a rule for
// what happens when a new area shows up anyway - a hash sidesteps both).
function hashString(value: string): number {
    let hash = 5381;

    for (let i = 0; i < value.length; i++) {
        hash = (hash * 33) ^ value.charCodeAt(i);
    }

    return hash >>> 0;
}

function colorForArea(area: string): string {
    // The modulo guarantees this index is always within bounds - the
    // non-null assertion is just satisfying noUncheckedIndexedAccess, not
    // papering over a real possibility of AREA_PALETTE being empty (it's a
    // fixed, non-empty literal above).
    return AREA_PALETTE[hashString(area) % AREA_PALETTE.length]!;
}

// The "first significant directory segment relative to the project/source
// root". Only one structural convention is hardcoded - a literal leading
// "src" segment is treated as a source-root wrapper to look past, so
// `src/core/scanner/discover.ts` reads as area "core", not area "src" -
// everything else is read directly from whatever the analyzed project's
// own top-level layout actually is (`scripts/`, `.github/`, `docs/`,
// a monorepo's `packages/`, ...), with no assumption about what any of
// those names are supposed to mean. A file with no directory component at
// all (sitting directly in the project root) or directly inside `src/`
// itself (no further subfolder) falls back to its own literal segment
// rather than a made-up label.
function computeModuleArea(relativePath: string): string {
    const segments = relativePath.replaceAll('\\', '/').split('/').filter(Boolean);

    if (segments.length <= 1) {
        return '(root)';
    }

    if (segments[0] === 'src' && segments.length > 2) {
        return segments[1]!;
    }

    return segments[0]!;
}

// Experimental (branch: experiment/cycle-map-v2). A long directory path
// with no spaces (the normal case - real paths are camelCase/kebab-case
// segments joined by '/') is one unbreakable "word" as far as text
// wrapping is concerned, so a fixed on-node text-max-width alone can't
// keep a node's rendered width bounded - the box just grows to fit that
// one long word regardless. This computes a presentation-only
// abbreviation instead, kept on the node's own single display line:
// whichever trailing path segments fit within maxLength characters,
// prefixed with an ellipsis when anything had to be dropped. Working
// backward from the END (not the start) keeps the segments closest to the
// actual file - generally the most specific, most useful-to-recognize
// part of the path - and drops the generic top-level ones first.
const DISPLAY_DIR_MAX_LENGTH = 28;

function computeDisplayDir(dir: string, maxLength: number = DISPLAY_DIR_MAX_LENGTH): string {
    if (dir.length <= maxLength) {
        return dir;
    }

    const segments = dir.split('/');
    let kept = '';

    for (let i = segments.length - 1; i >= 0; i--) {
        const candidate = kept ? segments[i]! + '/' + kept : segments[i]!;

        if (candidate.length > maxLength && kept !== '') {
            break;
        }

        kept = candidate;
    }

    return kept === dir ? dir : '…/' + kept;
}

type BuildNodes = {
    allNodes: Set<string>;
    sccs: string[][];
    metrics: Map<string, ModuleMetrics>;
    projectRoot?: string;
};
function buildNodes(args: BuildNodes): CytoscapeNode[] {
    const { allNodes, metrics, sccs, projectRoot } = args;

    const nodes: CytoscapeNode[] = [];

    const sccMap = new Map<string, number>();
    const sccSizeMap = new Map<string, number>();

    sccs.forEach((scc, index) => {
        for (const node of scc) {
            sccMap.set(node, index);
            sccSizeMap.set(node, scc.length);
        }
    });

    for (const node of allNodes) {
        const sccIndex = sccMap.get(node);
        const color =
            sccIndex !== undefined ? defaultColors[sccIndex % defaultColors.length] : undefined;
        const ca = metrics.get(node)?.ca ?? 0;
        const ce = metrics.get(node)?.ce ?? 0;
        const degree = ca + ce;
        // Relative to the project root when one is available (real CLI
        // usage always provides it) so the second label line and the area
        // below read as "src/features/cycles", not some long absolute
        // filesystem path. Falls back to the raw id's own directory
        // otherwise - harmless for the synthetic single-letter ids used in
        // this file's own unit tests.
        // path.relative rebuilds its result using the platform's native
        // separator regardless of the input paths' own style - on Windows
        // that means backslashes, even though every other path in this
        // codebase is normalized to '/' (see scanProject.ts, getArea.ts,
        // etc.). Normalize immediately, before dir/area derive from it -
        // path.dirname only truncates (never rewrites separators), so
        // computing it on an already-normalized string keeps dir/
        // displayDir forward-slash on every platform.
        const relativePath = (projectRoot ? path.relative(projectRoot, node) : node).replaceAll(
            '\\',
            '/'
        );
        const dir = path.dirname(relativePath);
        const normalizedDir = dir === '.' ? '' : dir;
        const area = computeModuleArea(relativePath);

        nodes.push({
            data: {
                id: node,
                // Always a short, real filename - not gated behind a degree
                // threshold. Isolated/low-degree files used to render with
                // no label at all (confirmed on real fixtures: most nodes
                // in a normal-sized project have degree <= 3), leaving the
                // reader unable to tell what most of the graph even was
                // without hovering every single node one at a time.
                label: path.basename(node),
                dir: normalizedDir,
                displayDir: computeDisplayDir(normalizedDir),
                color: color,
                sccId: sccIndex,
                area,
                areaColor: colorForArea(area),
                size: 20 + Math.log2(degree + 1) * 18,
                ce,
                ca,
                instability: metrics.get(node)?.instability ?? 0,
                sccSize: sccSizeMap.get(node) ?? 0,
            },
            classes: sccMap.get(node) !== undefined ? 'scc' : '',
        });
    }

    return nodes;
}

function buildEdges(graph: Map<string, Set<string>>): CytoscapeEdge[] {
    const edges: CytoscapeEdge[] = [];

    for (const [from, neighbors] of graph.entries()) {
        for (const to of neighbors) {
            edges.push({
                data: {
                    source: from,
                    target: to,
                },
            });
        }
    }

    return edges;
}

type BuildCytoscapeElements = {
    graph: DependencyGraph;
    sccs: string[][];
    metrics: Map<string, ModuleMetrics>;
    projectRoot?: string;
};

export function buildCytoscapeElements(args: BuildCytoscapeElements): {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
} {
    const { graph, metrics, sccs, projectRoot } = args;
    // findSCCs() (Kosaraju) returns a trivial size-1 "component" for every
    // node that isn't part of any real cycle - that's not a cycle and must
    // stay filtered out. But a real, honest cycle needs only 2 nodes
    // (A <-> B is the single most common real-world case - a direct
    // circular import), and `> 2` here was silently treating those exactly
    // like ordinary nodes: no color, no `.scc` class, nothing - even
    // though the CLI's own "Cycles detected"/"Largest SCC" output correctly
    // reported them. A 2-node SCC is still a real cycle; only a 1-node one
    // is the non-cycle case that needs excluding.
    const realSccs = sccs.filter((scc) => scc.length > 1);

    const nodes = buildNodes({
        // graph.nodes tracks every scanned file, including ones with zero
        // imports and zero importers - deriving the node set from
        // graph.edges instead (as this used to) silently drops those, since
        // addEdge only creates an edges-map entry for a file that has at
        // least one resolvable import.
        allNodes: graph.nodes,
        metrics,
        sccs: realSccs,
        projectRoot,
    });
    const edges = buildEdges(graph.edges);

    return {
        nodes,
        edges,
    };
}
