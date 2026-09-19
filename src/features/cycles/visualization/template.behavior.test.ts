// Real-DOM/real-cytoscape behavioral tests for template.ts's client script
// (P1-1..P1-5 audit). The rest of template.test.ts deliberately inspects
// the generated SOURCE (string/regex assertions on the embedded script) -
// that catches a lot, but can't prove the actual runtime STATE MACHINE
// behaves correctly across a sequence of real interactions (select, focus,
// switch focus, exit focus), which is exactly the class of bug this audit
// found (P1-4, P1-5). These tests drive the literal production script -
// extracted verbatim and executed via Node's vm module inside a real jsdom
// document, with the real cytoscape npm dependency running headless - see
// browserHarness.ts for the full mechanism and why each shim is needed.
import path from 'node:path';
import type { CytoscapeEdge, CytoscapeNode } from '../adapters';
import type { CycleFindings } from '../findings/buildCycleFindings';
import {
    closeAllRenderedReports,
    renderInteractiveReport,
    type CyCollection,
    type CyCore,
} from './__fixtures__/browserHarness';

// Focus's own 'cose' layout (runFocusLayout()) animates via a real
// window.setTimeout-based ~60fps tick loop (see browserHarness.ts's own
// comment on this) - fake timers keep those ticks from ever actually
// firing during a test (nothing here asserts on the layout's final
// settled positions, only on the '.not-in-view'/selection/HUD state
// focusScc() itself sets synchronously, well before the animation starts),
// which avoids both a slow real-time wait per test and a crash from a
// stray tick firing against an already-closed jsdom window.
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    closeAllRenderedReports();
    jest.useRealTimers();
});

function makeNode(id: string, overrides: Partial<CytoscapeNode['data']> = {}): CytoscapeNode {
    const dir = path.dirname(id);

    return {
        data: {
            id,
            label: path.basename(id),
            dir,
            displayDir: dir,
            area: 'src',
            areaColor: '#3b82f6',
            ...overrides,
        },
        classes: overrides.sccId !== undefined ? 'scc' : '',
    };
}

function edge(source: string, target: string): CytoscapeEdge {
    return { data: { source, target } };
}

// .position() isn't part of CyCore/CyElement's own deliberately-narrow
// structural surface (see browserHarness.ts's own comment on why) - real
// cytoscape has it, and the P2 race condition test below needs to compare
// exact node coordinates, not just classes.
// Read from the shipped script rather than duplicated here, so these tests
// follow the real cap instead of a copy that could drift.
function focusFullSccMaxOf(document: Document): number {
    const scriptText = Array.from(document.querySelectorAll('script'))
        .map((script) => script.textContent ?? '')
        .join('\n');
    const match = /const FOCUS_FULL_SCC_MAX = (\d+);/.exec(scriptText);

    if (!match) {
        throw new Error('FOCUS_FULL_SCC_MAX not found in the generated report script');
    }

    return Number(match[1]);
}

// Focus core = SCC members on screen that are not 1-hop '.focus-neighbor'
// context (another SCC member can be shown as a neighbour of the core).
function focusCoreMembers(cy: CyCore, idPrefix: string): CyCollection {
    return cy
        .nodes()
        .filter(
            (n) => n.id().startsWith(idPrefix) && !n.hasClass('not-in-view') && !n.hasClass('focus-neighbor'),
        );
}

function positionOf(cy: CyCore, id: string): { x: number; y: number } {
    return (cy.getElementById(id) as unknown as { position(): { x: number; y: number } }).position();
}

// Two independent real SCCs - a 2-node cycle (sccId 0) and a 3-node cycle
// (sccId 1) - plus one plain, non-cyclic node, matching the shape
// buildCytoscapeElements.ts really produces (sccId/sccSize/color/'scc'
// class only on real cycle members).
// F25 fixtures: one SCC (sccId 0) of a given topology, every node a member.
const BIG_SCC_PREFIX = '/repo/src/bigscc/';

type SccTopology = { ids: string[]; edges: CytoscapeEdge[]; exampleCycle: string[] };

// findCycleThroughNode is a top-level function of the report script, so a
// global in the harness - just not part of RenderedReport['win']'s type.
type WitnessSearch = { findCycleThroughNode(sccId: number, startId: string): string[] | null };

function sccIds(prefix: string, count: number): string[] {
    return Array.from({ length: count }, (_, i) => `${BIG_SCC_PREFIX}${prefix}${String(i).padStart(2, '0')}.ts`);
}

function singleSccFixture(
    ids: string[],
    edges: CytoscapeEdge[],
    exampleCycle: string[],
): { nodes: CytoscapeNode[]; edges: CytoscapeEdge[]; findings: CycleFindings } {
    return {
        nodes: ids.map((id) => makeNode(id, { sccId: 0, sccSize: ids.length, color: '#1b9e77' })),
        edges,
        findings: {
            moduleCount: ids.length,
            dependencyCount: edges.length,
            sccs: [{ id: 0, size: ids.length, memberIds: [...ids].sort(), exampleCycle }],
        },
    };
}

const HUB = `${BIG_SCC_PREFIX}hub.ts`;
const PARTNER = `${BIG_SCC_PREFIX}partner.ts`;

// hub <-> partner, plus hub -> via00 -> ... -> via46 -> hub. 49 members.
function detourTopology(): SccTopology {
    const via = sccIds('via', 47);
    return {
        ids: [HUB, PARTNER, ...via],
        edges: [
            edge(HUB, PARTNER),
            edge(PARTNER, HUB),
            edge(HUB, via[0]!),
            ...via.slice(0, -1).map((id, i) => edge(id, via[i + 1]!)),
            edge(via[via.length - 1]!, HUB),
        ],
        exampleCycle: [HUB, PARTNER, HUB],
    };
}

// hub <-> partner, hub <-> m00, and m00..m46 each importing the next three
// (mod 47): densely connected, no long detour needed. 49 members.
function shortCycleDenseMeshTopology(): SccTopology {
    const mesh = sccIds('m', 47);
    return {
        ids: [HUB, PARTNER, ...mesh],
        edges: [
            edge(HUB, PARTNER),
            edge(PARTNER, HUB),
            edge(HUB, mesh[0]!),
            edge(mesh[0]!, HUB),
            ...mesh.flatMap((id, i) => [1, 2, 3].map((step) => edge(id, mesh[(i + step) % mesh.length]!))),
        ],
        exampleCycle: [HUB, PARTNER, HUB],
    };
}

// hub <-> partner and hub <-> s00..s46 (a shared logger/config hub). Most
// non-core members are direct neighbours of hub, so this also checks that
// SCC members shown as '.focus-neighbor' are not counted as core. 49 members.
function hubSpokesTopology(): SccTopology {
    const spokes = sccIds('s', 47);
    return {
        ids: [HUB, PARTNER, ...spokes],
        edges: [edge(HUB, PARTNER), edge(PARTNER, HUB), ...spokes.flatMap((id) => [edge(HUB, id), edge(id, HUB)])],
        exampleCycle: [HUB, PARTNER, HUB],
    };
}

// Each member imports the next `reach` members (mod size).
function denseCirculantTopology(size: number, reach: number): SccTopology {
    const ids = sccIds('d', size);
    return {
        ids,
        edges: ids.flatMap((id, i) =>
            Array.from({ length: reach }, (_, k) => edge(id, ids[(i + k + 1) % size]!)),
        ),
        exampleCycle: [...ids, ids[0]!],
    };
}

function completeDigraphTopology(size: number): SccTopology {
    const ids = sccIds('k', size);
    return {
        ids,
        edges: ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => edge(a, b))),
        exampleCycle: [ids[0]!, ids[1]!, ids[0]!],
    };
}

function ringTopology(size: number): SccTopology {
    const ids = sccIds('r', size);
    return {
        ids,
        edges: ids.map((id, i) => edge(id, ids[(i + 1) % size]!)),
        exampleCycle: [...ids, ids[0]!],
    };
}

function twoIndependentSccsFixture(): { nodes: CytoscapeNode[]; edges: CytoscapeEdge[]; findings: CycleFindings } {
    const nodes: CytoscapeNode[] = [
        makeNode('/repo/src/pair/a1.ts', { sccId: 0, sccSize: 2, color: '#1b9e77' }),
        makeNode('/repo/src/pair/a2.ts', { sccId: 0, sccSize: 2, color: '#1b9e77' }),
        makeNode('/repo/src/ring/b1.ts', { sccId: 1, sccSize: 3, color: '#d95f02' }),
        makeNode('/repo/src/ring/b2.ts', { sccId: 1, sccSize: 3, color: '#d95f02' }),
        makeNode('/repo/src/ring/b3.ts', { sccId: 1, sccSize: 3, color: '#d95f02' }),
        makeNode('/repo/src/lonely.ts'),
    ];
    const edges: CytoscapeEdge[] = [
        edge('/repo/src/pair/a1.ts', '/repo/src/pair/a2.ts'),
        edge('/repo/src/pair/a2.ts', '/repo/src/pair/a1.ts'),
        edge('/repo/src/ring/b1.ts', '/repo/src/ring/b2.ts'),
        edge('/repo/src/ring/b2.ts', '/repo/src/ring/b3.ts'),
        edge('/repo/src/ring/b3.ts', '/repo/src/ring/b1.ts'),
    ];
    const findings: CycleFindings = {
        moduleCount: nodes.length,
        dependencyCount: edges.length,
        sccs: [
            {
                id: 0,
                size: 2,
                memberIds: ['/repo/src/pair/a1.ts', '/repo/src/pair/a2.ts'],
                exampleCycle: ['/repo/src/pair/a1.ts', '/repo/src/pair/a2.ts', '/repo/src/pair/a1.ts'],
            },
            {
                id: 1,
                size: 3,
                memberIds: ['/repo/src/ring/b1.ts', '/repo/src/ring/b2.ts', '/repo/src/ring/b3.ts'],
                exampleCycle: [
                    '/repo/src/ring/b1.ts',
                    '/repo/src/ring/b2.ts',
                    '/repo/src/ring/b3.ts',
                    '/repo/src/ring/b1.ts',
                ],
            },
        ],
    };

    return { nodes, edges, findings };
}

describe('template.ts client script - real DOM/cytoscape behavioral tests', () => {
    it('Findings -> View cycle -> Show in graph -> Focus -> selected module -> open another cycle -> Focus another cycle -> Back to full graph', () => {
        const { nodes, edges, findings } = twoIndependentSccsFixture();
        const { document, win, cy } = renderInteractiveReport({ nodes, edges, findings });

        // "Findings -> View cycle" for SCC #1 (id 0).
        win.openCycleDetailModalForScc(0);

        const modalBody = document.getElementById('cycle-detail-body');
        expect(modalBody?.innerHTML).toBeTruthy();

        const firstShowInGraphBtn = modalBody?.querySelector('[data-focus-scc-id]');
        expect(firstShowInGraphBtn).toBeTruthy();
        expect(firstShowInGraphBtn?.getAttribute('data-focus-scc-id')).toBe('0');

        // "Show in graph" - click the real button, exercising the real
        // registered event-delegation handler (cycleDetailBody's own
        // 'click' listener), not a direct function call.
        firstShowInGraphBtn?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

        // Focus toolbar reflects Focus is active.
        const showFullGraphBtn = document.getElementById('show-full-graph-btn');
        expect(showFullGraphBtn?.hidden).toBe(false);

        // P1-4: the Selected module panel must be populated - not empty -
        // right after Focus is entered via this exact flow.
        const hudSelectedBody = document.getElementById('hud-selected-body');
        expect(hudSelectedBody?.innerHTML.trim()).not.toBe('');
        expect(hudSelectedBody?.innerHTML).toContain('a1.ts');

        // "open another cycle" - Findings -> View cycle for SCC #2 (id 1),
        // while SCC #1 is still focused. This is the exact P1-5 regression
        // scenario: SCC #2's own members must not be misread as hidden by
        // the (unrelated, currently-active) Focus on SCC #1.
        win.openCycleDetailModalForScc(1);

        const secondShowInGraphBtn = modalBody?.querySelector('[data-focus-scc-id]');
        expect(secondShowInGraphBtn).toBeTruthy();
        expect(secondShowInGraphBtn?.getAttribute('data-focus-scc-id')).toBe('1');
        // Also proves the button did not silently disappear (the exact bug
        // report: "the button can disappear entirely").
        expect(modalBody?.querySelector('.cycle-detail-focus-btn')).toBeTruthy();

        // "Focus another cycle" - click it for real.
        secondShowInGraphBtn?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

        // Focus really switched to SCC #2's members - selection/HUD now
        // describe a b*.ts module, not the stale a1.ts from SCC #1.
        expect(hudSelectedBody?.innerHTML).toContain('.ts');
        expect(hudSelectedBody?.innerHTML.trim()).not.toBe('');
        expect(
            hudSelectedBody?.innerHTML.includes('b1.ts') ||
                hudSelectedBody?.innerHTML.includes('b2.ts') ||
                hudSelectedBody?.innerHTML.includes('b3.ts'),
        ).toBe(true);

        // Every SCC #2 member must now actually be on screen ('.not-in-view'
        // is the combined display-driving class - see P1-5's fix).
        for (const id of ['/repo/src/ring/b1.ts', '/repo/src/ring/b2.ts', '/repo/src/ring/b3.ts']) {
            expect(cy.getElementById(id).hasClass('not-in-view')).toBe(false);
        }
        // SCC #1's members are no longer part of the (now different) focus.
        for (const id of ['/repo/src/pair/a1.ts', '/repo/src/pair/a2.ts']) {
            expect(cy.getElementById(id).hasClass('not-in-view')).toBe(true);
        }

        // "Back to full graph".
        win.exitFocus();

        expect(showFullGraphBtn?.hidden).toBe(true);
        for (const node of [...nodes]) {
            expect(cy.getElementById(node.data.id).hasClass('not-in-view')).toBe(false);
        }
    });

    it('Focus SCC #1 -> Focus SCC #2 directly (HUD-style focusScc calls), then back to SCC #1 - never gets stuck', () => {
        const { nodes, edges, findings } = twoIndependentSccsFixture();
        const { win, cy } = renderInteractiveReport({ nodes, edges, findings });

        win.focusScc(0, '/repo/src/pair/a1.ts');
        expect(cy.getElementById('/repo/src/pair/a1.ts').hasClass('not-in-view')).toBe(false);
        expect(cy.getElementById('/repo/src/ring/b1.ts').hasClass('not-in-view')).toBe(true);

        // Focus SCC #2 while #1 is still active - the exact P1-5 regression:
        // before the fix, allMembers for SCC #2 came back empty (every
        // member wrongly read as "area-hidden" by the stale Focus #1
        // state) and this call was a silent no-op.
        win.focusScc(1, '/repo/src/ring/b1.ts');
        expect(cy.getElementById('/repo/src/ring/b1.ts').hasClass('not-in-view')).toBe(false);
        expect(cy.getElementById('/repo/src/ring/b2.ts').hasClass('not-in-view')).toBe(false);
        expect(cy.getElementById('/repo/src/ring/b3.ts').hasClass('not-in-view')).toBe(false);
        expect(cy.getElementById('/repo/src/pair/a1.ts').hasClass('not-in-view')).toBe(true);

        // And back to SCC #1 again - the switch works both directions.
        win.focusScc(0, '/repo/src/pair/a2.ts');
        expect(cy.getElementById('/repo/src/pair/a1.ts').hasClass('not-in-view')).toBe(false);
        expect(cy.getElementById('/repo/src/pair/a2.ts').hasClass('not-in-view')).toBe(false);
        expect(cy.getElementById('/repo/src/ring/b1.ts').hasClass('not-in-view')).toBe(true);
    });

    it('self-loop (P1-2): a lone self-importing module renders as a real, focusable 1-member SCC', () => {
        const nodes: CytoscapeNode[] = [
            makeNode('/repo/src/self.ts', { sccId: 0, sccSize: 1, color: '#1b9e77' }),
            makeNode('/repo/src/other.ts'),
        ];
        const edgesList: CytoscapeEdge[] = [edge('/repo/src/self.ts', '/repo/src/self.ts')];
        const findings: CycleFindings = {
            moduleCount: 2,
            dependencyCount: 1,
            sccs: [
                {
                    id: 0,
                    size: 1,
                    memberIds: ['/repo/src/self.ts'],
                    exampleCycle: ['/repo/src/self.ts', '/repo/src/self.ts'],
                },
            ],
        };
        const { document } = renderInteractiveReport({ nodes, edges: edgesList, findings });

        expect(document.querySelector('[data-finding-scc-id="0"]')).toBeTruthy();
    });

    it('Area filter set, then Focus entered and exited - the Area filter is restored exactly, not lost or double-applied', () => {
        const { nodes, edges, findings } = twoIndependentSccsFixture();
        // Give the two SCCs different areas so an Area filter actually
        // excludes one of them.
        nodes.find((n) => n.data.id === '/repo/src/ring/b1.ts')!.data.area = 'ring-area';
        nodes.find((n) => n.data.id === '/repo/src/ring/b2.ts')!.data.area = 'ring-area';
        nodes.find((n) => n.data.id === '/repo/src/ring/b3.ts')!.data.area = 'ring-area';

        const { document, win, cy } = renderInteractiveReport({ nodes, edges, findings });
        const areaSelect = document.getElementById('area-select') as HTMLSelectElement | null;

        if (areaSelect) {
            areaSelect.value = 'src';
            areaSelect.dispatchEvent(new win.Event('change'));

            // The pair SCC (area 'src') is visible; the ring SCC ('ring-area')
            // is filtered out.
            expect(cy.getElementById('/repo/src/pair/a1.ts').hasClass('not-in-view')).toBe(false);
            expect(cy.getElementById('/repo/src/ring/b1.ts').hasClass('not-in-view')).toBe(true);
        }

        // Focus the pair SCC (still within the 'src' area filter).
        win.focusScc(0, '/repo/src/pair/a1.ts');
        expect(cy.getElementById('/repo/src/pair/a1.ts').hasClass('not-in-view')).toBe(false);

        win.exitFocus();

        // Back to the Area-filtered Full Graph - exactly the pre-focus
        // state, not "everything visible" and not "everything hidden".
        if (areaSelect) {
            expect(cy.getElementById('/repo/src/pair/a1.ts').hasClass('not-in-view')).toBe(false);
            expect(cy.getElementById('/repo/src/ring/b1.ts').hasClass('not-in-view')).toBe(true);
        }
    });

    it('P0-1 regression, verified live: a 2-node hub cycle with 600 real neighbours still respects FOCUS_NEIGHBOR_LIMIT once focused', () => {
        const HUB_NEIGHBOUR_COUNT = 600;
        const nodes: CytoscapeNode[] = [
            makeNode('/repo/src/hub/logger.ts', { sccId: 0, sccSize: 2, color: '#1b9e77' }),
            makeNode('/repo/src/hub/config.ts', { sccId: 0, sccSize: 2, color: '#1b9e77' }),
        ];
        const edgesList: CytoscapeEdge[] = [
            edge('/repo/src/hub/logger.ts', '/repo/src/hub/config.ts'),
            edge('/repo/src/hub/config.ts', '/repo/src/hub/logger.ts'),
        ];

        for (let i = 0; i < HUB_NEIGHBOUR_COUNT; i++) {
            const id = `/repo/src/consumers/consumer${i}.ts`;
            nodes.push(makeNode(id));
            edgesList.push(edge(id, '/repo/src/hub/logger.ts'));
        }

        const findings: CycleFindings = {
            moduleCount: nodes.length,
            dependencyCount: edgesList.length,
            sccs: [
                {
                    id: 0,
                    size: 2,
                    memberIds: ['/repo/src/hub/config.ts', '/repo/src/hub/logger.ts'],
                    exampleCycle: ['/repo/src/hub/logger.ts', '/repo/src/hub/config.ts', '/repo/src/hub/logger.ts'],
                },
            ],
        };

        const { win, cy } = renderInteractiveReport({ nodes, edges: edgesList, findings });

        win.focusScc(0, '/repo/src/hub/logger.ts');

        const visibleConsumers = cy
            .nodes()
            .filter((n) => n.id().startsWith('/repo/src/consumers/') && !n.hasClass('not-in-view'));

        // FOCUS_NEIGHBOR_LIMIT is 30 - the shown neighbour set must stay
        // capped regardless of the real 600-neighbour fan-in, exactly the
        // regression P0-1 fixed. An overflow summary proxy node must exist
        // in its place instead of silently dropping the rest.
        expect(visibleConsumers.length).toBeLessThanOrEqual(30);
        expect(visibleConsumers.length).toBeGreaterThan(0);
        expect(cy.getElementById('focus-overflow-proxy').empty()).toBe(false);
    });

    // F8 regression, verified live: focusScc() computes currentFocus.nodeIds
    // (the layout/fit membership set) BEFORE refreshAreaView() adds the
    // overflow proxy node, so isNodeInCurrentView() never counts the proxy
    // as part of the focused view - it is excluded from runFocusLayout()'s
    // own cose run (which only lays out visibleElements(cy)) and never
    // gets a position, leaving it at cytoscape's own default (0, 0) even
    // once the layout has fully converged. Same convergence budget as the
    // P2 fix test above (2000ms, regardless of graph size).
    it('F8 regression, verified live: the Focus overflow proxy is positioned once the layout converges, not stuck at (0, 0)', () => {
        const HUB_NEIGHBOUR_COUNT = 600;
        const nodes: CytoscapeNode[] = [
            makeNode('/repo/src/hub/logger.ts', { sccId: 0, sccSize: 2, color: '#1b9e77' }),
            makeNode('/repo/src/hub/config.ts', { sccId: 0, sccSize: 2, color: '#1b9e77' }),
        ];
        const edgesList: CytoscapeEdge[] = [
            edge('/repo/src/hub/logger.ts', '/repo/src/hub/config.ts'),
            edge('/repo/src/hub/config.ts', '/repo/src/hub/logger.ts'),
        ];

        for (let i = 0; i < HUB_NEIGHBOUR_COUNT; i++) {
            const id = `/repo/src/consumers/consumer${i}.ts`;
            nodes.push(makeNode(id));
            edgesList.push(edge(id, '/repo/src/hub/logger.ts'));
        }

        const findings: CycleFindings = {
            moduleCount: nodes.length,
            dependencyCount: edgesList.length,
            sccs: [
                {
                    id: 0,
                    size: 2,
                    memberIds: ['/repo/src/hub/config.ts', '/repo/src/hub/logger.ts'],
                    exampleCycle: ['/repo/src/hub/logger.ts', '/repo/src/hub/config.ts', '/repo/src/hub/logger.ts'],
                },
            ],
        };

        const { win, cy } = renderInteractiveReport({ nodes, edges: edgesList, findings });

        win.focusScc(0, '/repo/src/hub/logger.ts');

        expect(cy.getElementById('focus-overflow-proxy').empty()).toBe(false);

        jest.advanceTimersByTime(2000);

        expect(positionOf(cy, 'focus-overflow-proxy')).not.toEqual({ x: 0, y: 0 });
    });

    it('F25: large SCC (above FOCUS_FULL_SCC_MAX) with a short internal cycle - the Focus core still fills to FOCUS_FULL_SCC_MAX, not to the witness cycle length', () => {
        // A pure ring has no shorter cycle than the whole ring itself, so
        // it can't exercise the truncation path at all - this shape
        // instead gives the SCC a genuine short cycle (hub<->partner)
        // PLUS a long detour (hub -> via00 -> ... -> via46 -> hub) that
        // merges the same 48 extra nodes into the one 50-member SCC
        // without being part of the shortest concrete cycle through hub.
        const DETOUR_LENGTH = 47;
        const detourIds = Array.from({ length: DETOUR_LENGTH }, (_, i) => `/repo/src/bigscc/via${String(i).padStart(2, '0')}.ts`);
        const allIds = ['/repo/src/bigscc/hub.ts', '/repo/src/bigscc/partner.ts', ...detourIds];
        const sccSize = allIds.length;
        const nodes: CytoscapeNode[] = allIds.map((id) => makeNode(id, { sccId: 0, sccSize, color: '#1b9e77' }));
        const edgesList: CytoscapeEdge[] = [
            edge('/repo/src/bigscc/hub.ts', '/repo/src/bigscc/partner.ts'),
            edge('/repo/src/bigscc/partner.ts', '/repo/src/bigscc/hub.ts'),
            edge('/repo/src/bigscc/hub.ts', detourIds[0]!),
            ...detourIds.slice(0, -1).map((id, i) => edge(id, detourIds[i + 1]!)),
            edge(detourIds[detourIds.length - 1]!, '/repo/src/bigscc/hub.ts'),
        ];

        const findings: CycleFindings = {
            moduleCount: allIds.length,
            dependencyCount: edgesList.length,
            sccs: [
                {
                    id: 0,
                    size: sccSize,
                    memberIds: [...allIds].sort(),
                    exampleCycle: ['/repo/src/bigscc/hub.ts', '/repo/src/bigscc/partner.ts', '/repo/src/bigscc/hub.ts'],
                },
            ],
        };

        const { document, win, cy } = renderInteractiveReport({ nodes, edges: edgesList, findings });

        win.focusScc(0, '/repo/src/bigscc/hub.ts');

        const focusFullSccMax = focusFullSccMaxOf(document);
        const coreSccMembers = focusCoreMembers(cy, '/repo/src/bigscc/');

        // F25: the short hub<->partner witness cycle must not shrink the
        // core below the cap - excess members are cut by FOCUS_FULL_SCC_MAX,
        // not by how short a cycle through the start node happens to be.
        // Counts core members only: SCC members pulled in as
        // '.focus-neighbor' context are not part of the core.
        expect(sccSize).toBeGreaterThan(focusFullSccMax);
        expect(coreSccMembers.length).toBe(Math.min(sccSize, focusFullSccMax));
        expect(cy.getElementById('/repo/src/bigscc/hub.ts').hasClass('not-in-view')).toBe(false);
        expect(cy.getElementById('/repo/src/bigscc/partner.ts').hasClass('not-in-view')).toBe(false);

        // The Selected module panel must reflect the real focused node,
        // not stay empty (P1-4) even for this large-SCC fallback path.
        const hudSelectedBody = win.document.getElementById('hud-selected-body');
        expect(hudSelectedBody?.innerHTML.trim()).not.toBe('');
        expect(hudSelectedBody?.innerHTML).toContain('hub.ts');
    });

    // F5 (AUDIT_v0.11.0.md): a pure ring SCC has no shorter cycle than the
    // whole ring itself, so findCycleThroughNode(sccId, startId) - the
    // "representative cycle" search focusScc() falls back to above
    // FOCUS_FULL_SCC_MAX - returns a path through every single member. Before
    // this fix, coreMembers was set to exactly that path with no further cap,
    // so a 45-member ring rendered all 45 nodes at once (the audit's
    // "cycles-large" 50-module SCC, 5% zoom) while isRepresentativeOnly was
    // still (incorrectly) true, making #focus-status claim a truncation that
    // never actually happened.
    it('F5: a large pure-ring SCC (no shorter cycle exists) is still capped at FOCUS_FULL_SCC_MAX core nodes', () => {
        const RING_SIZE = 45;
        const ringIds = Array.from({ length: RING_SIZE }, (_, i) => `/repo/src/ring/r${String(i).padStart(2, '0')}.ts`);
        const nodes: CytoscapeNode[] = ringIds.map((id) => makeNode(id, { sccId: 0, sccSize: RING_SIZE, color: '#1b9e77' }));
        const edgesList: CytoscapeEdge[] = ringIds.map((id, i) => edge(id, ringIds[(i + 1) % RING_SIZE]!));

        const findings: CycleFindings = {
            moduleCount: ringIds.length,
            dependencyCount: edgesList.length,
            sccs: [
                {
                    id: 0,
                    size: RING_SIZE,
                    memberIds: [...ringIds].sort(),
                    exampleCycle: [...ringIds, ringIds[0]!],
                },
            ],
        };

        const { document, win, cy } = renderInteractiveReport({ nodes, edges: edgesList, findings });

        win.focusScc(0, ringIds[0]!);

        // '.focus-neighbor' marks the (separately, already-correctly
        // bounded by FOCUS_NEIGHBOR_LIMIT) 1-hop context nodes focusScc()
        // adds around the core - for this ring shape, the truncation
        // boundary itself creates up to two such neighbours (the ring
        // member just past the cut, and the one that wraps back to the
        // start). The FOCUS_FULL_SCC_MAX invariant is about the CORE only;
        // it says nothing about how many neighbours a shape happens to have.
        const visibleRingCoreMembers = focusCoreMembers(cy, '/repo/src/ring/');
        const hiddenRingMembers = cy.nodes().filter((n) => n.id().startsWith('/repo/src/ring/') && n.hasClass('not-in-view'));

        // The FOCUS_FULL_SCC_MAX cap must hold even when the "representative
        // cycle" search can only return the entire ring - the core stays
        // readable instead of silently rendering all 45 members at once.
        // Exact, not just an upper bound: the cap is also the target (F25).
        expect(visibleRingCoreMembers.length).toBe(Math.min(RING_SIZE, focusFullSccMaxOf(document)));
        expect(hiddenRingMembers.length).toBeGreaterThan(0);
        expect(cy.getElementById(ringIds[0]!).hasClass('not-in-view')).toBe(false);

        // The caption must agree with what's actually on screen: real
        // truncation happened, so the representative-cycle note is correct
        // here (unlike the pre-fix bug, this assertion alone wouldn't have
        // caught it - see the shownCoreCount comment below).
        const focusStatus = document.getElementById('focus-status');
        expect(focusStatus?.hidden).toBe(false);
        expect(focusStatus?.textContent).toContain('45');
    });

    // F25: the number of SCC members in the Focus core is a coverage
    // invariant - min(sccSize, FOCUS_FULL_SCC_MAX) - independent of the SCC's
    // shape, of which member Focus was entered from, and of how short the
    // witness cycle through that member is. No test here pins WHICH members
    // form the core; only how many.
    describe('F25: Focus core coverage', () => {
        it('dense SCC above FOCUS_FULL_SCC_MAX: the core fills to FOCUS_FULL_SCC_MAX', () => {
            const { ids, edges: edgesList, exampleCycle } = denseCirculantTopology(49, 5);
            const { document, win, cy } = renderInteractiveReport(singleSccFixture(ids, edgesList, exampleCycle));
            const focusFullSccMax = focusFullSccMaxOf(document);

            win.focusScc(0, ids[0]!);

            expect(ids.length).toBeGreaterThan(focusFullSccMax);
            expect(focusCoreMembers(cy, BIG_SCC_PREFIX).length).toBe(focusFullSccMax);
        });

        it.each([
            ['dense K12', () => completeDigraphTopology(12)],
            ['ring of exactly FOCUS_FULL_SCC_MAX', () => ringTopology(40)],
        ])('SCC at or below FOCUS_FULL_SCC_MAX (%s): every member is in the core and no truncation is claimed', (_name, build) => {
            const { ids, edges: edgesList, exampleCycle } = build();
            const { document, win, cy } = renderInteractiveReport(singleSccFixture(ids, edgesList, exampleCycle));

            expect(ids.length).toBeLessThanOrEqual(focusFullSccMaxOf(document));

            win.focusScc(0, ids[0]!);

            expect(focusCoreMembers(cy, BIG_SCC_PREFIX).length).toBe(ids.length);
            expect(document.getElementById('focus-status')?.hidden).toBe(true);
        });

        it.each([
            ['short cycle + long detour', detourTopology],
            ['short cycle + dense mesh', shortCycleDenseMeshTopology],
            ['short cycle + hub spokes', hubSpokesTopology],
        ])('same-size SCC (%s): a witness cycle exists and is shorter than the SCC, yet the core still fills to FOCUS_FULL_SCC_MAX', (_name, build) => {
            const { ids, edges: edgesList, exampleCycle } = build();
            const { document, win, cy } = renderInteractiveReport(singleSccFixture(ids, edgesList, exampleCycle));
            const focusFullSccMax = focusFullSccMaxOf(document);
            const start = [...ids].sort()[0]!;

            const witness = (win as unknown as WitnessSearch).findCycleThroughNode(0, start);

            expect(witness).not.toBeNull();
            expect(witness![0]).toBe(start);
            expect(witness![witness!.length - 1]).toBe(start);
            expect(witness!.length - 1).toBeLessThan(ids.length);

            win.focusScc(0, start);

            expect(ids.length).toBe(49);
            expect(focusCoreMembers(cy, BIG_SCC_PREFIX).length).toBe(Math.min(ids.length, focusFullSccMax));
        });

        it('SCC members shown as .focus-neighbor are context, not core: they are counted separately from the core', () => {
            const { ids, edges: edgesList, exampleCycle } = hubSpokesTopology();
            const { document, win, cy } = renderInteractiveReport(singleSccFixture(ids, edgesList, exampleCycle));

            win.focusScc(0, HUB);

            const visible = cy.nodes().filter((n) => n.id().startsWith(BIG_SCC_PREFIX) && !n.hasClass('not-in-view'));
            const neighbours = visible.filter((n) => n.hasClass('focus-neighbor'));
            const core = focusCoreMembers(cy, BIG_SCC_PREFIX);

            expect(core.length).toBe(focusFullSccMaxOf(document));
            expect(neighbours.length).toBeGreaterThan(0);
            expect(core.length + neighbours.length).toBe(visible.length);
        });

        it.each(['hub.ts', 'partner.ts', 'via10.ts', 'via46.ts'])(
            'the core size does not depend on which member Focus is entered from (start: %s)',
            (startName) => {
                const { ids, edges: edgesList, exampleCycle } = detourTopology();
                const { document, win, cy } = renderInteractiveReport(singleSccFixture(ids, edgesList, exampleCycle));

                win.focusScc(0, BIG_SCC_PREFIX + startName);

                expect(cy.getElementById(BIG_SCC_PREFIX + startName).hasClass('not-in-view')).toBe(false);
                expect(focusCoreMembers(cy, BIG_SCC_PREFIX).length).toBe(
                    Math.min(ids.length, focusFullSccMaxOf(document)),
                );
            },
        );
    });

    // P2 fix, verified live: runFocusLayout()'s cose layout runs with
    // animate: true (~1.7-2.6s to converge - see positionOf()'s own note on
    // why 20ms is "still mid-animation" regardless of graph size). Exiting
    // Focus (Show full graph / Fit Graph / a programmatic exitFocus() call)
    // while that layout is still running used to leave it going in the
    // background: it kept repositioning its own frozen focus-subgraph node
    // set on every remaining animation frame, then its late 'layoutstop'
    // fired onLayoutFinished(cy, 'cose') against the already-restored Full
    // Graph - wiping every edge's taxi-routing class graph-wide ('cose' has
    // no entry in ORTHOGONAL_LAYOUT_AXES) and leaving a mix of stale
    // mid-animation and restored positions. This reproduces the exact
    // sequence from the confirmed report: Focus -> exit before layoutstop
    // -> layoutstop -> check Full Graph.
    it('P2 fix: exiting Focus before its cose layout finishes animating never corrupts Full Graph positions or edge routing', () => {
        const { nodes, edges, findings } = twoIndependentSccsFixture();
        const { document, win, cy } = renderInteractiveReport({ nodes, edges, findings });

        // Ground truth: Full Graph's own positions/edge routing exactly as
        // the initial synchronous flowVertical layout left them, captured
        // before Focus touches anything - what exitFocus() must land back on.
        const originalPositions = new Map(nodes.map((n) => [n.data.id, positionOf(cy, n.data.id)]));
        expect(cy.edges().filter((e) => e.hasClass('orthogonal-edge-vertical')).length).toBe(cy.edges().length);

        win.focusScc(0, '/repo/src/pair/a1.ts');

        const showFullGraphBtn = document.getElementById('show-full-graph-btn');
        expect(showFullGraphBtn?.hidden).toBe(false);

        // One animation tick in (jsdom's requestAnimationFrame ticks at
        // 1000/60ms under fake timers - see browserHarness.ts). cose's own
        // cooling schedule (temperature *= 0.99 per iteration, starting at
        // 1000, 20 iterations per tick, minTemp 1.0) needs roughly 35 ticks
        // to converge regardless of graph size, so this guarantees the
        // layout is still genuinely running, nowhere near its own natural
        // 'layoutstop'.
        jest.advanceTimersByTime(20);

        // The exact reported repro: click "Show full graph" before layoutstop.
        showFullGraphBtn?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

        expect(showFullGraphBtn?.hidden).toBe(true);
        for (const node of nodes) {
            expect(cy.getElementById(node.data.id).hasClass('not-in-view')).toBe(false);
        }

        // Flush every remaining animation frame the old (now-aborted) cose
        // layout still had queued - cytoscape's own guaranteed one-more-frame
        // after .stop(), and, if this race isn't fixed, the layout's late
        // natural 'layoutstop' this test exists to catch.
        jest.advanceTimersByTime(2000);

        for (const [id, pos] of originalPositions) {
            expect(positionOf(cy, id)).toEqual(pos);
        }

        // A stale onLayoutFinished(cy, 'cose') call would wipe this class
        // graph-wide - it must never have run.
        expect(cy.edges().filter((e) => e.hasClass('orthogonal-edge-vertical')).length).toBe(cy.edges().length);
        expect(cy.edges().filter((e) => e.hasClass('orthogonal-edge-horizontal')).length).toBe(0);
    });
});
