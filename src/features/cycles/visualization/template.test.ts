import { buildHtmlTemplate } from './template';
import { selectFocusCore } from './focusCoreSelection';
import { selectFocusNeighbours } from './focusNeighbourSelection';
import {
    edgeNodeOverlapIterationsFor,
    nodeOverlapIterationsFor,
    resolveEdgeNodeOverlaps,
    resolveNodeOverlaps,
} from './graphOverlapResolution';
import type { CytoscapeEdge, CytoscapeNode } from '../adapters';
import type { CycleFindings } from '../findings/buildCycleFindings';

// Most tests in this file exercise something other than the findings
// summary itself (escaping, SCC navigation, Focus, the cycle modal) and
// don't care about its specific numbers - this is the shared "nothing to
// report" payload for those, matching what a real 0-cycle project would
// produce. Tests that DO care about the summary's own rendering build
// their own CycleFindings value instead of using this.
const EMPTY_FINDINGS: CycleFindings = { moduleCount: 0, dependencyCount: 0, sccs: [] };

// Information architecture rework: the Findings view now server-renders
// one block per supported language (see renderFindingsOverview in
// template.ts), only one of them ever visible at a time client-side -
// English is always first (SUPPORTED_LANGUAGES[0] in i18n.ts) and is the
// only block most content-shape tests care about. Slicing out just that
// block keeps exact-count assertions (e.g. "exactly N finding rows")
// correct regardless of how many languages exist, rather than every such
// test needing to know and multiply by that count itself.
function extractEnglishFindingsBlock(html: string): string {
    const start = html.indexOf('data-lang="en"');
    const end = html.indexOf('data-lang="fi"');
    return html.slice(start, end);
}

describe('buildHtmlTemplate HTML/script escaping', () => {
    it('does not embed a raw </script> sequence when a node id contains one', () => {
        // A crafted file path containing "</script><script>...</script>" would
        // close the enclosing inline <script> tag early and let arbitrary
        // markup/script run when the report is opened, regardless of how the
        // JSON payload itself is formed - this reproduces that exact case.
        const nodes: CytoscapeNode[] = [
            {
                data: {
                    id: '</script><script>alert(1)</script>.ts',
                    label: '</script><script>alert(1)</script>.ts',
                    dir: '',
                    displayDir: '',
                    area: 'src',
                    areaColor: '#9ca3af',
                },
            },
        ];
        const edges: CytoscapeEdge[] = [];

        const html = buildHtmlTemplate({ nodes, edges, findings: EMPTY_FINDINGS });

        expect(html).not.toContain('</script><script>alert(1)</script>');
    });

    it('the static template source itself never contains a literal closing script tag outside the real ones', () => {
        // Found the hard way while building SCC member navigation: an
        // explanatory //-comment inside the inline <script> block that
        // happened to spell out the literal text "</script>" (to describe
        // THIS EXACT vulnerability, for a crafted node id) silently
        // truncated the whole inline script at that exact point when the
        // browser's HTML parser tokenized it - HTML looks for that literal
        // byte sequence to close a <script> element regardless of it being
        // inside a JS comment/string. Everything after it in the script
        // silently became inert markup instead of running: no exception
        // anywhere (a syntactically valid, shorter script ran to
        // completion), so it surfaced only as "cy" resolving to the
        // #cy <div> itself (a plain DOM element has no .nodes()) rather
        // than the real cytoscape instance, with zero console/page error
        // to point at the cause. This is independent of node/edge DATA
        // (the crafted-id test above), which safeJsonForScript already
        // escapes - this guards the template's own STATIC source text,
        // which nothing escapes, since it's real code, not embedded data.
        // Exactly 4 are expected regardless of node/edge content: the 3
        // real <script src="..."> asset tags plus the one real closing
        // tag for the inline script itself - any more means something
        // (almost certainly a comment) is spelling out the literal
        // sequence again.
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html.match(/<\/script>/g)).toHaveLength(4);
    });

    it('still embeds the real node data, just safely encoded', () => {
        const nodes: CytoscapeNode[] = [
            {
                data: {
                    id: 'src/a.ts',
                    label: 'a.ts',
                    dir: '',
                    displayDir: '',
                    area: 'src',
                    areaColor: '#9ca3af',
                },
            },
        ];
        const edges: CytoscapeEdge[] = [];

        const html = buildHtmlTemplate({ nodes, edges, findings: EMPTY_FINDINGS });

        expect(html).toContain('src/a.ts');
        expect(html).toContain('"label":"a.ts"');
    });

    it('defines a client-side escapeHtml helper used before setting tooltip innerHTML', () => {
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain('function escapeHtml(value)');
        expect(html).toContain('escapeHtml(title)');
        expect(html).toContain('function renderPathWithDirHighlight(rawPath)');
        expect(html).toContain('renderPathWithDirHighlight(data.id)');
    });
});

describe('buildHtmlTemplate SCC-vs-cycle terminology', () => {
    // A non-trivial SCC (2+ mutually reachable modules) is guaranteed to
    // contain at least one dependency cycle, but is not itself a single
    // cycle - it can contain several distinct, possibly overlapping
    // cycles. Both the per-node HUD block and the educational modal must
    // describe the SCC as a whole rather than asserting the group forms
    // one specific cycle, since nothing in this codebase computes an
    // actual cycle path.
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    it('the per-node SCC context block describes an SCC, not "a cycle"', () => {
        // Full localization task: this text is now composed at runtime
        // from I18N_DICTIONARIES via formatI18nClient/dict lookups rather
        // than baked into the JS source as literal English - the English
        // wording itself still lives in the embedded dictionary JSON, so
        // it's asserted there instead of as literal template-string text.
        expect(html).toContain('strongly connected component (SCC #%id) of %n modules.');
        expect(html).toContain('This SCC contains one or more dependency cycles.');
        expect(html).toContain('Other modules in this SCC:');
        expect(html).toContain('dict.sccContextOtherMembers');
    });

    it('never claims a group of SCC members IS a single detected cycle', () => {
        expect(html).not.toContain('Other modules in this cycle');
        expect(html).not.toContain('Detected cycle (SCC #');
        expect(html).not.toContain('is what this report highlights as a detected cycle');
    });

    it('the educational modal explains that an SCC is not itself one cycle', () => {
        expect(html).toContain('data-i18n="eduModalWhatIsSccHeading">What is an SCC?</h3>');
        expect(html).toContain('an SCC is not itself a');
        expect(html).toContain('single cycle');
        expect(html).toContain('data-i18n="eduModalHowToInvestigateHeading">How to investigate a detected SCC</h3>');
    });

    it('preserves the architectural-awareness emphasis line, extended to cover SCC', () => {
        expect(html).toContain('A detected cycle or SCC is not automatically an architectural violation.');
    });
});

describe('buildHtmlTemplate global SCC summary (findings data foundation)', () => {
    // Findings data foundation (Phase 0): this summary used to be computed
    // client-side, aggregating over cy.nodes()'s sccId/sccSize attributes
    // after the graph library loaded (computeSccSummary(cy)/
    // renderSccSummary(cy), both removed). It's now server-rendered
    // directly from the real CycleFindings payload (buildCycleFindings.ts,
    // Kosaraju/findSCCs-derived) - these tests assert the RENDERED HTML
    // text for real findings shapes, not client-side source structure,
    // since there's no client-side computation left to inspect.

    it('renders a neutral empty state instead of a fabricated "0 cycles" when there are no SCCs', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: { moduleCount: 3, dependencyCount: 2, sccs: [] },
        });

        expect(html).toContain('No dependency SCCs detected.');
        expect(html).toContain('3 modules · 2 dependencies');
    });

    it('renders the count and largest size for a single SCC', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 5,
                dependencyCount: 6,
                sccs: [{ id: 0, size: 3, memberIds: ['a.ts', 'b.ts', 'c.ts'], exampleCycle: ['a.ts', 'b.ts', 'c.ts', 'a.ts'] }],
            },
        });

        expect(html).toContain('Detected SCCs: 1 &middot; Largest SCC: 3 modules.');
        expect(html).toContain('5 modules · 6 dependencies');
    });

    it('renders the largest size among multiple SCCs of different sizes, not the first or last', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 16,
                dependencyCount: 17,
                sccs: [
                    { id: 0, size: 2, memberIds: ['left.ts', 'right.ts'], exampleCycle: ['left.ts', 'right.ts', 'left.ts'] },
                    {
                        id: 1,
                        size: 7,
                        memberIds: ['ring0.ts', 'ring1.ts', 'ring2.ts', 'ring3.ts', 'ring4.ts', 'ring5.ts', 'ring6.ts'],
                        exampleCycle: ['ring0.ts', 'ring1.ts', 'ring2.ts', 'ring3.ts', 'ring4.ts', 'ring5.ts', 'ring6.ts', 'ring0.ts'],
                    },
                ],
            },
        });

        expect(html).toContain('Detected SCCs: 2 &middot; Largest SCC: 7 modules.');
    });

    it('never phrases the SCC summary as a cycle count', () => {
        // The whole point of the earlier terminology fix: SCC count is not
        // cycle count (one SCC can contain more than one cycle) - checked
        // against #scc-summary-text's own rendered content specifically
        // (not the whole page): the page as a whole legitimately contains
        // the phrase "cycles detected" elsewhere now (the Findings zero
        // state's own text, embedded via the i18n dictionary for the
        // language switcher regardless of whether the CURRENT findings
        // happen to be empty) - that's a different, correct piece of
        // copy, not this summary being mislabeled.
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 2,
                dependencyCount: 2,
                sccs: [{ id: 0, size: 2, memberIds: ['a.ts', 'b.ts'], exampleCycle: ['a.ts', 'b.ts', 'a.ts'] }],
            },
        });

        const summaryStart = html.indexOf('id="scc-summary-text"');
        const summaryEnd = html.indexOf('</span>', summaryStart);
        const summaryText = html.slice(summaryStart, summaryEnd).toLowerCase();

        expect(summaryStart).toBeGreaterThan(-1);
        expect(summaryText).not.toContain('cycles detected');
        expect(html).toContain('Detected SCCs:');
    });

    it('states on-screen that the count covers the whole analyzed graph, not the current filter', () => {
        // This caption predates being backed by real data and must keep
        // being true now that it is: moduleCount/dependencyCount/sccs all
        // come from analyzeCycles.ts scanning the WHOLE project, never
        // from whatever the Area/Connections filters currently show -
        // there is no client-side recomputation left that could silently
        // make this caption inaccurate.
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain('entire analyzed graph, not the current filtered view');
    });

    it('no longer computes the summary client-side - the old cy.nodes()-based aggregation is gone', () => {
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html).not.toContain('function computeSccSummary');
        expect(html).not.toContain('function renderSccSummary');
    });
});

describe('buildHtmlTemplate SCC member navigation', () => {
    function sccNode(id: string, label: string, sccId: number, sccSize: number): CytoscapeNode {
        return {
            data: {
                id,
                label,
                dir: '',
                displayDir: '',
                area: 'src',
                areaColor: '#9ca3af',
                sccId,
                sccSize,
            },
        };
    }

    it('reuses the exact same selection mechanics for a plain graph click and a member-name click', () => {
        // selectNode() must be the ONE place selectedNodeId is ever
        // assigned - both cy.on('tap', 'node', ...) (a direct click) and
        // navigateToSccMember() (a click on an "Other modules in this
        // SCC" name) call it, rather than each having its own copy of the
        // select/highlight/HUD-update sequence.
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain('function selectNode(node)');
        expect(html).toMatch(/cy\.on\('tap', 'node', \(event\) => \{\s*selectNode\(event\.target\);\s*\}\)/);
        expect(html).toContain('selectedNodeId = data.id;');
        // Only ONE assignment site for selectedNodeId to a real node's id -
        // guards against a future change accidentally duplicating the
        // selection logic instead of reusing selectNode().
        expect(html.match(/selectedNodeId = data\.id;/g)).toHaveLength(1);
    });

    it('navigateToSccMember looks nodes up by their real, stable cytoscape id - never by label/path text', () => {
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain('function navigateToSccMember(nodeId)');
        expect(html).toContain('cy.getElementById(nodeId)');
        expect(html).toContain('cy.center(node)');
        expect(html).toContain('selectNode(node)');
    });

    it('delegates the click handler on the HUD panel itself, since its innerHTML is fully replaced on every selection', () => {
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain("hudSelectedBody?.addEventListener('click'");
        expect(html).toContain("event.target.closest('[data-scc-nav-id]')");
    });

    // buildCycleContextHtml() (like the rest of the per-node HUD logic) is
    // client-side JS that only runs in the browser once a real cytoscape
    // instance exists - buildHtmlTemplate() itself just embeds its source
    // once, unconditionally, plus a JSON payload of the real node data.
    // The three tests below confirm the DATA a 7-member and a 2-member SCC
    // actually carry into that payload (id/sccId/sccSize, for both sizes,
    // and their absence for a plain node) - the closest thing to a
    // "does the right member link get rendered" proof Jest can make
    // without a live DOM. The actual rendered <span data-scc-nav-id="...">
    // markup, and a real click navigating to the right node, are verified
    // separately via headless Chrome against the real large-cycle-app
    // fixture (both its 7-node ring and its 2-node pair).

    it('embeds full sccId/sccSize/id data for every member of a 7-node SCC', () => {
        const ring = Array.from({ length: 7 }, (_, i) => sccNode(`/repo/src/ring/ring${i}.ts`, `ring${i}.ts`, 0, 7));
        const html = buildHtmlTemplate({ nodes: ring, edges: [], findings: EMPTY_FINDINGS });

        for (let i = 0; i < 7; i++) {
            expect(html).toContain(`"id":"/repo/src/ring/ring${i}.ts"`);
        }
        expect(html.match(/"sccId":0/g)).toHaveLength(7);
        expect(html.match(/"sccSize":7/g)).toHaveLength(7);
    });

    it('embeds full sccId/sccSize/id data for a 2-node SCC', () => {
        const pair = [
            sccNode('/repo/src/pair/left.ts', 'left.ts', 1, 2),
            sccNode('/repo/src/pair/right.ts', 'right.ts', 1, 2),
        ];
        const html = buildHtmlTemplate({ nodes: pair, edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain('"id":"/repo/src/pair/left.ts"');
        expect(html).toContain('"id":"/repo/src/pair/right.ts"');
        expect(html.match(/"sccId":1/g)).toHaveLength(2);
        expect(html.match(/"sccSize":2/g)).toHaveLength(2);
    });

    it('a node outside any SCC carries no sccId/sccSize data for buildCycleContextHtml to act on', () => {
        const plain: CytoscapeNode = {
            data: {
                id: '/repo/src/entry.ts',
                label: 'entry.ts',
                dir: '',
                displayDir: '',
                area: 'src',
                areaColor: '#9ca3af',
            },
        };
        const html = buildHtmlTemplate({ nodes: [plain], edges: [], findings: EMPTY_FINDINGS });

        // buildCycleContextHtml()'s existing, untouched guard
        // (data.sccSize < 2 || data.sccId === undefined -> return '')
        // relies on these keys being genuinely absent, not just falsy -
        // confirmed here at the data layer; the guard clause itself (and
        // that it still produces no clickable-member markup at runtime)
        // is checked further below / via headless Chrome.
        expect(html).not.toContain('"sccId"');
        expect(html).not.toContain('"sccSize"');
    });

    it('buildCycleContextHtml only ever renders member-navigation markup for a real (2+) SCC', () => {
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain('data.sccSize < 2 || data.sccId === undefined');
    });

    it('a member hidden by the Area/Connections filter renders as a plain, explicitly non-navigable name', () => {
        // The actual '.area-hidden' check runs against live cytoscape
        // state in the browser (verified separately via headless Chrome
        // against the real large-cycle-app fixture, since Jest here only
        // renders the static page shell, not a live cy instance) - this
        // confirms the source contains that exact guard and wording, so a
        // hidden member never gets a data-scc-nav-id in the first place.
        const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain("candidate.hasClass('area-hidden')");
        expect(html).toContain('hud-scc-member-hidden');
        expect(html).toContain('(hidden by filter)');
    });

    it('escapes a node id safely as an HTML attribute value, not just as text', () => {
        // escapeHtml() alone doesn't escape '"' (browsers don't escape it
        // when serializing textContent back to innerHTML) - a crafted id
        // containing one could otherwise break out of
        // data-scc-nav-id="...". Reproduces this codebase's own existing
        // "crafted file path" security-testing convention (see the
        // </script> escaping tests above) for this new attribute
        // specifically.
        const malicious = sccNode('/repo/"><script>alert(1)</script>.ts', 'evil.ts', 2, 2);
        const partner = sccNode('/repo/partner.ts', 'partner.ts', 2, 2);
        const html = buildHtmlTemplate({ nodes: [malicious, partner], edges: [], findings: EMPTY_FINDINGS });

        expect(html).toContain('function escapeAttribute(value)');
        expect(html).not.toContain('data-scc-nav-id="/repo/"><script>alert(1)</script>.ts"');
        expect(html).not.toContain('<script>alert(1)</script>.ts"');
    });
});

describe('buildHtmlTemplate Focused Graph (real subgraph, not viewport-only fade)', () => {
    // Graph UX pass: Focus SCC/"Show in graph" now build a REAL local
    // subgraph (everything outside the focused SCC/cycle + its 1-hop
    // neighbours is hidden via the exact same '.area-hidden' mechanism the
    // Area/Connections filter already uses - see isNodeInCurrentView()/
    // isEdgeInCurrentView() being focus-aware) laid out with the existing
    // Force Directed layout, rather than the old fade-in-place-on-the-
    // full-graph behavior. buildCycleContextHtml/focusScc/exitFocus are
    // client-side functions whose SOURCE is embedded once, unconditionally
    // - Jest can't spin up a live cytoscape instance to execute them, so
    // these assert source structure (the right guard/formula/wiring
    // exists) rather than a rendered result for a specific fixture. The
    // actual live behavior (a real click producing a real, smaller,
    // recomputed subgraph) is verified separately via headless Chrome
    // against real fixtures (large-cycle-app's 7-node ring, nightmare-app's
    // 2-node pair, and synthetic small/medium/huge SCCs).
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    it('renders a Focus SCC action, gated behind the same real-SCC (2+ members) guard as member navigation, carrying the selected node as its start id', () => {
        // focusButtonHtml is computed inside buildCycleContextHtml, after
        // its early `data.sccSize < 2 || data.sccId === undefined -> return
        // ''` guard - so a node outside any SCC gets '' from the whole
        // function, Focus button included, exactly like the member list
        // above it. data-focus-start-id carries the SELECTED node's own id
        // (data.id) - focusScc() needs it to pick a representative cycle
        // for a huge SCC (see FOCUS_FULL_SCC_MAX below).
        expect(html).toContain('data-focus-scc-id="${data.sccId}"');
        expect(html).toContain('data-focus-start-id="${escapeAttribute(data.id)}"');
        expect(html).toContain('class="hud-focus-scc-btn"');
        const guardIndex = html.indexOf('data.sccSize < 2 || data.sccId === undefined');
        const buttonIndex = html.indexOf('data-focus-scc-id="${data.sccId}"');
        expect(guardIndex).toBeGreaterThan(-1);
        expect(buttonIndex).toBeGreaterThan(guardIndex);
    });

    it('does not render a Focus action for a plain node outside any SCC (same early-return as the member list)', () => {
        // buildCycleContextHtml returns '' entirely before either
        // otherMembersHtml or focusButtonHtml is computed - a plain node
        // (no sccId) never reaches the code that could produce a Focus
        // button, the same guard already proven (line ~281 above) to
        // suppress the member-navigation markup.
        expect(html).toMatch(/if \(!data\.sccSize \|\| data\.sccSize < 2 \|\| data\.sccId === undefined\) \{\s*return '';\s*\}/);
    });

    it('targets the SELECTED node\'s own SCC - the button\'s id comes from that node\'s own data.sccId, not another member\'s', () => {
        // buildCycleContextHtml receives the SELECTED node (the HUD is
        // always built for whichever node is currently selected) and reads
        // `data` from IT via `node.data()` - the button embeds `data.sccId`
        // (the selected node's own field), never e.g. `otherMembers[0]` or
        // a hardcoded/looked-up id. The click handler then passes that same
        // number, plus the selected node's own id, straight through to
        // focusScc, with no remapping.
        expect(html).toContain('const data = node.data();');
        expect(html).toContain('data-focus-scc-id="${data.sccId}"');
        expect(html).toContain('focusScc(Number(focusEl.dataset.focusSccId), focusEl.dataset.focusStartId);');
    });

    it('accounts for every AVAILABLE (non-hidden) member when determining the HUD button\'s own "of N" count, for an SCC of any size', () => {
        // visibleMemberCount = the selected node itself + every OTHER
        // member not '.area-hidden' - computed over the FULL otherMembers
        // collection (cy.nodes().filter(sccId match)), not the
        // MAX_SCC_MEMBERS_SHOWN-truncated "shown" list used only for the
        // rendered name list. This one formula is size-agnostic: it must
        // correctly account for all 7 members of large-cycle-app's ring SCC
        // and all 2 members of its pair SCC alike, without a
        // size-specific branch - confirmed here by asserting it reads from
        // `otherMembers` (the untruncated collection), not `shown`. (This
        // count feeds the HUD button's own label before Focus is even
        // entered - focusScc() below independently derives its OWN, actual
        // core/shown count once focus is live.)
        expect(html).toContain(
            'const visibleMemberCount = 1 + otherMembers.filter((candidate) => !candidate.hasClass(\'area-hidden\')).length;',
        );
        expect(html).not.toContain('shown.filter((candidate) => !candidate.hasClass(\'area-hidden\'))');
    });

    it('focusScc itself independently re-derives its member set the same way (own sccId match, non-hidden only) rather than trusting the button', () => {
        // Belt-and-suspenders, matching this file's existing convention
        // (navigateToSccMember re-checks '.area-hidden' rather than
        // trusting the HUD's own rendering) - focusScc must filter
        // cy.nodes() by sccId and exclude '.area-hidden' independently, so
        // a stale button (filters changed between render and click) can't
        // focus on a member that isn't actually visible. This is the one
        // formula that must work correctly whether the SCC has 2 members,
        // 7, or 500 - it isn't given a count, it derives its own set.
        expect(html).toContain('function focusScc(sccId, startId)');
        expect(html).toMatch(
            /candidate\.data\('sccId'\) === sccId && !candidate\.hasClass\('area-hidden'\)/,
        );
        expect(html).toContain('if (allMembers.length < 2) {');
    });

    it('above FOCUS_FULL_SCC_MAX members, the core comes from selectFocusCore (embedded verbatim), not from a cycle through the start node (F25)', () => {
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        const focusFnSource = html.slice(focusFnStart, focusFnEnd);

        expect(html).toContain('const FOCUS_FULL_SCC_MAX = 40;');
        expect(focusFnStart).toBeGreaterThan(-1);
        expect(focusFnSource).toContain('if (allMembers.length > FOCUS_FULL_SCC_MAX) {');
        expect(focusFnSource).toContain('selectFocusCore(memberIds, internalEdgeRefs, resolvedStartId, FOCUS_FULL_SCC_MAX)');
        expect(focusFnSource).toContain('isRepresentativeOnly = true;');
        expect(focusFnSource).not.toContain('findCycleThroughNode(');
        expect(html).toContain(selectFocusCore.toString());
        // The witness-cycle search still exists exactly once, for the
        // concrete-cycle modal.
        expect(html.match(/function findCycleThroughNode\(sccId, startId\)/g)).toHaveLength(1);
    });

    it('the focused set is the core (whole SCC, or the representative cycle) UNION its direct (1-hop) neighbours, bounded by FOCUS_NEIGHBOR_LIMIT - never a 2nd-hop expansion or an unbounded fan-in/fan-out (P0-1 fix)', () => {
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        const focusFnSource = html.slice(focusFnStart, focusFnEnd);

        // Candidates are derived directly from edges touching coreIds
        // (structurally 1-hop only - there is no second traversal off the
        // neighbour set itself, unlike the old .neighborhood('node') call
        // this replaces), then ranked/capped by the real, unit-tested
        // selectFocusNeighbours() rather than shown in full.
        expect(focusFnSource).toContain('const neighbourEdgeRefs = cy');
        expect(focusFnSource).toContain('const sourceIsCore = coreIds.has(edge.source().id());');
        expect(focusFnSource).toContain('const targetIsCore = coreIds.has(edge.target().id());');
        expect(focusFnSource).toContain(
            'selectFocusNeighbours(\n                    Array.from(coreIds),\n                    neighbourEdgeRefs,\n                    FOCUS_NEIGHBOR_LIMIT,\n                )',
        );
        expect(focusFnSource).toContain('const neighbours = cy.nodes().filter((node) => shownNeighbourIds.has(node.id()));');
        expect(focusFnSource).toContain('coreMembers.union(neighbours)');
        // The old unbounded traversal (coreMembers.neighborhood('node'),
        // taken in full with no ranking or cap) is gone, not just capped
        // after the fact.
        expect(focusFnSource).not.toContain("coreMembers\n                    .neighborhood('node')");
    });

    it('FOCUS_NEIGHBOR_LIMIT is a named, documented constant (not a magic number buried inside focusScc), independent of FOCUS_FULL_SCC_MAX', () => {
        expect(html).toContain('const FOCUS_NEIGHBOR_LIMIT = 30;');
        // Declared once, outside focusScc's own body, exactly like
        // FOCUS_FULL_SCC_MAX already is.
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        expect(html.indexOf('const FOCUS_NEIGHBOR_LIMIT = 30;')).toBeLessThan(focusFnStart);
    });

    it('selectFocusNeighbours - the exact function unit-tested in focusNeighbourSelection.test.ts - is embedded verbatim into the client script, not reimplemented inline', () => {
        expect(html).toContain(selectFocusNeighbours.toString());
    });

    it('the hub-cycle regression scenario (a 2-node cycle with 600 external importers, e.g. logger/config) never balloons Focused Graph: the neighbour cap keeps the shown set at FOCUS_NEIGHBOR_LIMIT regardless of real fan-in size', () => {
        // template.ts's client script is glue over cytoscape - it can't be
        // executed here (no live cytoscape/DOM in Jest, see this describe
        // block's own top comment) - but the algorithm it delegates to
        // (asserted embedded verbatim in the previous test) is executed for
        // real, with exactly this shape, in
        // focusNeighbourSelection.test.ts's own "600 neighbours" case. This
        // test documents the link: the invariant that test enforces
        // (shown.length stays at the limit, never at 600) is the same
        // invariant this Focused Graph view depends on for real projects.
        const neighbourIds = Array.from({ length: 600 }, (_, i) => `module${i}`);
        const edges = [
            { source: 'logger', target: 'config' },
            { source: 'config', target: 'logger' },
            ...neighbourIds.map((id) => ({ source: id, target: 'logger' })),
        ];

        const result = selectFocusNeighbours(['logger', 'config'], edges, 30);

        expect(result.shown).toHaveLength(30);
        expect(result.shown.length + 2).toBeLessThan(40);
    });

    it('actually hides everything outside the focused set - reuses refreshAreaView()/the real .area-hidden mechanism, not a fade-in-place-on-the-full-graph', () => {
        // This is the core semantic change from the old "viewport-only"
        // Focus: isNodeInCurrentView()/isEdgeInCurrentView() now check
        // currentFocus FIRST (see their own describe block), so calling
        // the SAME refreshAreaView() the Area/Connections filter already
        // uses is what actually hides non-focused elements - not a second,
        // parallel hiding mechanism.
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        const focusFnSource = html.slice(focusFnStart, focusFnEnd);

        expect(focusFnSource).toContain('refreshAreaView();');
        expect(focusFnSource).toContain("neighbours.addClass('focus-neighbor');");
        expect(html.match(/function refreshAreaView\(\)/g)).toHaveLength(1);
    });

    it('runs the existing Force Directed layout (layouts.cose reused as-is) on the focused subgraph, not a new layout algorithm', () => {
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        const focusFnSource = html.slice(focusFnStart, focusFnEnd);

        expect(html).toContain('function runFocusLayout()');
        expect(html).toContain("Object.assign({}, layouts.cose, { randomize: false })");
        expect(html).toContain("visibleElements(cy).layout(focusLayoutConfig)");
        expect(html).toContain("onLayoutFinished(cy, 'cose')");
        expect(focusFnSource).toContain('runFocusLayout();');
    });

    it('disables Layout/Area/Connections while focused - they describe the Full Graph, not a narrowed local view', () => {
        expect(html).toContain('function setFocusToolbarState(isFocused)');
        expect(html).toContain('layoutSelect.disabled = isFocused;');
        expect(html).toContain('areaSelect.disabled = isFocused;');
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        expect(html.slice(focusFnStart, focusFnEnd)).toContain('setFocusToolbarState(true);');
    });

    it('exiting focus ("Show full graph") restores the full graph exactly - same node positions, zoom, and pan as before Focus ran its own layout', () => {
        // preFocusSnapshot (positions + zoom + pan, captured once on first
        // entry) is what makes "Back to full graph" a true restore instead
        // of a fresh re-fit that would silently discard whatever zoom/pan
        // state the user had before entering Focus.
        expect(html).toContain('function exitFocus()');
        expect(html).toContain('currentFocus = null;');
        expect(html).toContain('showFullGraphButton.hidden = true;');
        expect(html).toContain('setFocusToolbarState(false);');
        expect(html).toContain('refreshAreaView();');
        expect(html).toContain('preFocusSnapshot.positions.forEach((pos, id) => {');
        expect(html).toContain('cy.zoom(preFocusSnapshot.zoom);');
        expect(html).toContain('cy.pan(preFocusSnapshot.pan);');
        expect(html).toContain(
            "showFullGraphButton?.addEventListener('click', () => {\n                exitFocus();\n            });",
        );
        // The Layout dropdown still calls exitFocus() first (a layout
        // re-run moves nodes and changes the Focus/Area filter has never
        // applied to, so it exits rather than risk a stale framing) - out
        // of scope for F18, unchanged here.
        expect(html).toContain('exitFocus();\n\n                const runningLayout');
    });

    it('F18 fix (AUDIT_v0.11.0.md): "Fit Graph" does NOT call exitFocus() - it stays in Focus and fits whatever visibleElements(cy) currently resolves to (the focused subgraph while focused, the full graph otherwise)', () => {
        // (exitFocus is a hoisted function declaration, defined later in
        // source order than this call site - that's fine at runtime, so
        // this checks the CALL is absent at this site, not source position.)
        const fitBtnStart = html.indexOf('fitButton.addEventListener(');
        const fitBtnEnd = html.indexOf('fitCyAvoidingChrome(cy, 40);', fitBtnStart);
        expect(fitBtnStart).toBeGreaterThan(-1);
        expect(fitBtnEnd).toBeGreaterThan(fitBtnStart);
        expect(html.slice(fitBtnStart, fitBtnEnd)).not.toContain('exitFocus();');
    });

    it('a member hidden by the current filter can never make the HUD\'s own Focus button claim the whole SCC is shown', () => {
        // The pre-focus HUD button's own label already says "N of M
        // modules visible" whenever a filter has hidden part of the SCC
        // (visibleMemberCount < data.sccSize), rather than presenting a
        // plain "(M modules)" count that would read as "the whole thing is
        // on screen". The label text comes from I18N_DICTIONARIES
        // (dict.focusSccButton + a formatted moduleCountVisibleParen/
        // moduleCountParen suffix).
        expect(html).toContain('visibleMemberCount < data.sccSize');
        expect(html).toContain(
            "dict.focusSccButton + ' ' + focusCountSuffix"
        );
        expect(html).toContain('moduleCountVisibleParen');
        expect(html).toContain('moduleCountParen');
    });

    it('the exit button\'s own "(X of Y modules)" label and the representative-cycle/neighbour-truncation disclosures are both driven by updateFocusToolbarLabels(), re-run on language switch too', () => {
        expect(html).toContain('function updateFocusToolbarLabels()');
        expect(html).toContain('dict.showFullGraphButton + \' \' + countSuffix');
        expect(html).toContain('dict.focusRepresentativeNote');
        // P0-1 fix: the core-only "(X of Y modules)" count never claims the
        // whole focused view is shown - #focus-status now discloses BOTH a
        // representative-cycle truncation AND a neighbour-count truncation,
        // whichever apply, instead of only the former.
        expect(html).toContain('dict.focusNeighborsTruncatedNote');
        expect(html).toContain('currentFocus.overflowNeighbourIds.size > 0');
        expect(html).toContain('focusStatusEl.hidden = notes.length === 0;');
        // Re-run from applyLanguage()'s own dynamic re-render block.
        expect(html).toMatch(/if \(currentFocus\) \{\s*updateFocusToolbarLabels\(\);/);
    });

    it('P0-1 honesty fix: currentFocus carries real shown/overflow neighbour counts, not just the core SCC count - the exit label can no longer imply the whole graph is 2 nodes while hundreds more are actually rendered', () => {
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        const focusFnSource = html.slice(focusFnStart, focusFnEnd);

        expect(focusFnSource).toContain('overflowNeighbourIds,');
        expect(focusFnSource).toContain('neighborsShownCount: shownNeighbourIds.size,');
        expect(focusFnSource).toContain('neighborsTotalCount: shownNeighbourIds.size + overflowNeighbourIds.size,');
    });

    it('overflow neighbours (beyond FOCUS_NEIGHBOR_LIMIT) are aggregated via a single summary proxy node, reusing the exact same proxy mechanism/classes/cleanup as the Area filter\'s external-connections proxies - not a second aggregation implementation', () => {
        expect(html).toContain('function addFocusOverflowProxies(cy, focus)');
        // Same removal call, same classes - a single removeExternalConnectionProxies()
        // clears both an area-proxy and a focus-overflow-proxy alike.
        expect(html).toContain("cy.remove('.external-area-proxy, .external-proxy-edge');");
        expect(html).toContain("classes: 'external-area-proxy'");
        expect(html).toContain('isExternalProxy: true,\n                        isFocusOverflowProxy: true,');
        // Proxy edges are deduplicated per (core member, direction) pair,
        // not one per real edge - unlike addExternalConnectionProxies,
        // which preserves one per real crossing edge (bounded by area
        // count there, but hundreds of overflow neighbours here would
        // otherwise recreate exactly the blowup this fix removes).
        expect(html).toContain("const dedupKey = coreId + '::' + direction;");
        expect(html).toContain('if (seenDirections.has(dedupKey)) {');
        // Wired into refreshAreaView() as the focused counterpart to the
        // area-filter branch - mutually exclusive, since Focus and the Area
        // filter's external-connections mode are never both active.
        expect(html).toMatch(
            /if \(currentFocus\) \{\s*addFocusOverflowProxies\(cy, currentFocus\);\s*\} else if \(currentAreaFilter && currentConnectionMode === 'external'\) \{\s*addExternalConnectionProxies\(cy, currentAreaFilter\);\s*\}/,
        );
    });

    it('clicking the focus-overflow proxy shows an honest, distinctly-worded panel (not the "External area: %name" wording, which does not apply to it)', () => {
        expect(html).toContain('if (data.isFocusOverflowProxy) {');
        expect(html).toContain('dict.focusOverflowProxyLabel');
        expect(html).toContain('dict.focusOverflowPanelBody');
    });

    it('the global SCC summary stays a whole-graph count, unaffected by Focus - never becomes a focused-subset summary', () => {
        // Findings data foundation (Phase 0): the summary is server-
        // rendered static markup (#scc-summary/#scc-summary-text, filled
        // in from the real CycleFindings payload before this script ever
        // runs) rather than something recomputed client-side - so the
        // property this test protects ("Focus can't narrow the summary to
        // just the focused SCC") holds by construction. This re-confirms
        // that construction directly: neither focusScc() nor exitFocus()
        // ever writes to the summary's markup.
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        const focusAndExitSource = html.slice(focusFnStart, focusFnEnd);

        expect(focusFnStart).toBeGreaterThan(-1);
        expect(focusAndExitSource).not.toContain('scc-summary');
        expect(html).toContain('entire analyzed graph, not the current filtered view');
    });
});

describe('buildHtmlTemplate Focused Graph edge/node visual hierarchy', () => {
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    it('marks every edge between two same-SCC nodes as .cycle-edge, once, right after construction - not toggled by selection/focus', () => {
        expect(html).toContain('function markCycleEdges(cy)');
        expect(html).toContain("sourceSccId !== undefined && sourceSccId === targetSccId");
        expect(html).toContain("edge.addClass('cycle-edge');");
        expect(html).toContain('markCycleEdges(cy);');
    });

    it('.cycle-edge is styled after .highlighted-edge in the stylesheet array, so it always wins the "most prominent" tier', () => {
        const highlightedIndex = html.indexOf("selector: '.highlighted-edge'");
        const cycleEdgeIndex = html.indexOf("selector: '.cycle-edge'");
        expect(highlightedIndex).toBeGreaterThan(-1);
        expect(cycleEdgeIndex).toBeGreaterThan(highlightedIndex);
    });

    it('.focus-neighbor (direct-neighbour dimming) exists as its own style tier, distinct from .faded', () => {
        expect(html).toContain("selector: '.focus-neighbor'");
    });
});

describe('buildHtmlTemplate concrete dependency cycle', () => {
    // An SCC only says WHICH modules are mutually reachable - not HOW the
    // dependencies actually loop back, and it can contain more than one
    // distinct cycle. findCycleThroughNode/openCycleDetailModal are
    // client-side functions whose SOURCE is embedded once, unconditionally
    // (like every other function in this file) - Jest can't execute them
    // against a live cytoscape instance, so most of what follows asserts
    // source structure (the right guard/algorithm/wiring exists) rather
    // than a computed result for a specific fixture. The actual algorithm
    // output - a real 2-node cycle (left.ts -> right.ts -> left.ts), a
    // real 7-node cycle matching large-cycle-app's own ring in the exact
    // order ring2 -> ring3 -> ring4 -> ring5 -> ring6 -> ring0 -> ring1 ->
    // ring2, the selected node starting and closing the returned path,
    // every edge in it being a real graph edge, and the same input always
    // producing the same output (called twice) - is verified separately
    // via headless Chrome against the real large-cycle-app fixture.
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    it('finds one 2-node cycle (A -> B -> A) via a bounded BFS back to the start, not full enumeration', () => {
        // The algorithm: step to the selected node's own first (sorted,
        // so deterministic) outgoing neighbor within its SCC, then run a
        // plain BFS - visiting each member at most once - back to the
        // start. This is what a 2-node SCC's own cycle (left.ts <->
        // right.ts) reduces to: one step out, one BFS step back. Real
        // output confirmed via headless Chrome.
        expect(html).toContain('function findCycleThroughNode(sccId, startId)');
        expect(html).toContain("candidate.data('sccId') === sccId");
        expect(html).toContain('const firstStep = realStartTargets[0] ?? startTargets[0];');
        expect(html).toContain('const cameFrom = new Map([[firstStep, null]]);');
    });

    it('finds a 7-node cycle scoped to just that SCC\'s own members, never the whole graph', () => {
        // memberIds/adjacency are built only from nodes whose sccId
        // matches the one being asked about - large-cycle-app's real
        // 7-node ring (verified via headless Chrome to come back in
        // exactly ring2 -> ring3 -> ring4 -> ring5 -> ring6 -> ring0 ->
        // ring1 -> ring2 order when starting from ring2.ts) never touches
        // the other, unrelated 2-node SCC or any plain non-SCC node - the
        // adjacency map is built strictly from members of the ONE scc id
        // passed in.
        expect(html).toContain("const members = cy.nodes().filter((candidate) => candidate.data('sccId') === sccId);");
        expect(html).toContain('const memberIds = new Set(members.map((node) => node.id()));');
    });

    it('the returned path starts and ends at the selected node - the cycle is guaranteed to close', () => {
        // The BFS searches FOR startId (`if (current === startId) { break; }`)
        // and the final return value explicitly prepends startId to the
        // reconstructed chain (`[startId].concat(backToFirstStep)`), whose
        // own last element is guaranteed to be startId itself (that's the
        // BFS target) - so path[0] === path[path.length - 1] === the
        // selected node by construction, not by chance. Confirmed live via
        // headless Chrome (path[0]/path.at(-1) both equal the clicked
        // module's id for both the 7-node and 2-node fixtures).
        expect(html).toContain('if (current === startId) {');
        expect(html).toContain('return [startId].concat(backToFirstStep);');
    });

    it('operates on real, directed graph edges only - never a synthesized or reversed edge', () => {
        // Adjacency comes directly from cy.edges()'s own source/target
        // data fields (the exact same fields buildCytoscapeElements.ts
        // embeds for every real dependency edge) - no edge is invented,
        // reversed, or deduplicated away from its real direction.
        expect(html).toContain("const sourceId = edge.data('source');");
        expect(html).toContain("const targetId = edge.data('target');");
        expect(html).toContain('adjacency.get(sourceId).push(targetId);');
    });

    it('is deterministic - fixed sorted adjacency and a fixed starting neighbor, not a random/unordered choice', () => {
        expect(html).toContain('adjacency.forEach((targets) => targets.sort());');
        expect(html).toContain('const firstStep = realStartTargets[0] ?? startTargets[0];');
    });

    it('reads the WHOLE analyzed graph, not the currently filtered view - a cycle is a fact independent of Area/Connections', () => {
        // Unlike focusScc (which deliberately excludes '.area-hidden'
        // candidates because it's a viewport action bound to what's
        // currently on screen), findCycleThroughNode's own member/edge
        // scan has no '.area-hidden' filter at all - matching the task's
        // explicit requirement that cycle detection is a fact about the
        // whole analyzed graph, never about the current filter. Honesty
        // about what's actually visible is handled separately, downstream,
        // by openCycleDetailModal's own hidden-member accounting (see the
        // "hidden members" test below) - not by silently dropping hidden
        // members from the search itself, which could otherwise report a
        // shorter, wrong cycle just because part of it is filtered out.
        const fnStart = html.indexOf('function findCycleThroughNode(sccId, startId)');
        const fnEnd = html.indexOf('function ', fnStart + 1);
        const fnSource = html.slice(fnStart, fnEnd);

        expect(fnSource).not.toContain('area-hidden');
    });

    it('F7: a self-loop on the alphabetically-first member does not derail the cycle into a trivial A->A (parity with the server\'s pickFirstStep, buildCycleFindings.ts)', () => {
        // The server's own pickFirstStep (buildCycleFindings.ts) filters
        // out a self-target before picking the first BFS step, exactly to
        // avoid this. findCycleThroughNode's `const firstStep =
        // startTargets[0];` has no such filter - extracted here and run
        // against a stub `cy` (array-based nodes()/edges(), same
        // data()/id() shape cytoscape provides) to prove it live, the same
        // way buildCycleFindings.test.ts proves the server twin.
        const fnStart = html.indexOf('function findCycleThroughNode(sccId, startId)');
        const fnEnd = html.indexOf('function ', fnStart + 1);
        const fnSource = html.slice(fnStart, fnEnd);

        const makeNode = (id: string, sccId: string) => ({
            id: () => id,
            data: (key: string) => (key === 'sccId' ? sccId : undefined),
        });
        const makeEdge = (source: string, target: string) => ({
            data: (key: string) => (key === 'source' ? source : target),
        });

        // Same shape as buildCycleFindings.test.ts's self-loop fixture:
        // a.ts -> a.ts (self), a.ts -> b.ts, b.ts -> c.ts, c.ts -> a.ts.
        const nodes = [makeNode('a.ts', 'scc-1'), makeNode('b.ts', 'scc-1'), makeNode('c.ts', 'scc-1')];
        const edges = [
            makeEdge('a.ts', 'a.ts'),
            makeEdge('a.ts', 'b.ts'),
            makeEdge('b.ts', 'c.ts'),
            makeEdge('c.ts', 'a.ts'),
        ];
        const cy = { nodes: () => nodes, edges: () => edges };

        const findCycleThroughNode = new Function('cy', `${fnSource}\nreturn findCycleThroughNode;`)(cy);
        const path = findCycleThroughNode('scc-1', 'a.ts');

        expect(path.length).toBeGreaterThan(2);
        expect(new Set(path.slice(0, -1))).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
    });

    it('never claims the shown cycle is the only one within the SCC', () => {
        // UI polish split the old single long sentence into a short,
        // concrete subtitle ("what this modal is for") plus its own quiet
        // caveat line ("This SCC may contain other dependency cycles.") -
        // the caveat is what this test actually guards; the wording
        // changed, the guarantee it encodes (never implying uniqueness)
        // did not.
        expect(html).toContain('This SCC may contain other dependency cycles.');
        expect(html).not.toContain('the only dependency cycle');
        expect(html).not.toContain('This SCC is the cycle');
        expect(html).not.toContain('This is the cycle');
    });

    it('"Show a dependency cycle" is gated behind the same real-SCC guard as Focus, and never appears for a plain node', () => {
        // cycleButtonHtml is computed inside buildCycleContextHtml, after
        // its early `data.sccSize < 2 || data.sccId === undefined ->
        // return ''` guard - a plain node outside any SCC gets '' from the
        // whole function before either button is ever built. Carries the
        // SELECTED node's own id (not just its sccId) - "a cycle through
        // THIS module", not an arbitrary cycle anywhere in its SCC.
        const guardIndex = html.indexOf('data.sccSize < 2 || data.sccId === undefined');
        const buttonIndex = html.indexOf('data-show-cycle-node-id="${escapeAttribute(data.id)}"');

        expect(guardIndex).toBeGreaterThan(-1);
        expect(buttonIndex).toBeGreaterThan(guardIndex);
        expect(html).toContain('class="hud-cycle-detail-btn"');
    });

    it('a large cycle never gets enumerated - the visual collapses to a fixed head/tail, but the ordered list always keeps every member', () => {
        // buildCycleFlowCells only ever slices its OWN local `chips`
        // array (head/tail, for display) once past MAX_CYCLE_CHIPS_SHOWN -
        // it never slices or drops from `memberNodes` itself.
        // buildCycleListHtml maps over the full, unsliced `memberNodes`
        // array with no length cap and no truncation - a 150-module cycle
        // stays fully listed (CSS makes it scrollable, see styles.ts,
        // rather than the report ever hiding a member from the list). The
        // whole search algorithm (see the tests above) is already a
        // bounded single BFS, never an enumeration of multiple candidate
        // cycles - there's exactly one path-finding pass per click,
        // independent of the SCC's size.
        expect(html).toContain('const MAX_CYCLE_CHIPS_SHOWN = 20;');
        expect(html).toMatch(/function buildCycleListHtml\(memberNodes, dict\) \{\s*return memberNodes\s*\.map/);
        expect(html).not.toMatch(/function buildCycleListHtml[\s\S]{0,400}\.slice\(/);
    });

    it('a member hidden by the current filter is marked, never silently claimed visible', () => {
        // P1-5 fix: '.not-in-view' (genuinely on-screen right now, Focus
        // included), not the narrower Area-only '.area-hidden' - a member
        // hidden either by the Area filter OR by an active Focus renders as
        // plain, non-navigable text (no data-cycle-nav-id), and whenever at
        // least one member is hidden, an explicit note states exactly how
        // many of the cycle's modules are affected, rather than presenting
        // the ordered list as if the whole cycle were on screen.
        //
        // P1 fix (final pre-release audit): '.not-in-view' alone doesn't
        // say WHY - only '.area-hidden' (Focus-independent) does, so the
        // aggregate note is now split into an area-caused count and a
        // Focus-caused count, each with its own wording, rather than one
        // hiddenCount always blaming "the current filter" even when Focus
        // alone is the actual cause (see openCycleDetailModal/
        // buildCycleContextHtml/buildCycleListHtml's own comments).
        expect(html).toContain("node.hasClass('not-in-view')");
        expect(html).toContain('cycle-detail-item-hidden');
        expect(html).toContain('hidden by the current filter');
        expect(html).toContain('hidden by the current Focus');
        expect(html).toContain('areaHiddenCount > 0');
        expect(html).toContain('focusHiddenCount > 0');
    });

    it('opening/closing the modal never touches selection or Focus state on its own', () => {
        // The close button's own handler is a bare `.close()` call - no
        // exitFocus(), no selectedNodeId mutation. The one deliberate
        // exception (clicking a module INSIDE the list) explicitly reuses
        // navigateToSccMember() - the exact same select+center mechanism
        // as the SCC member list, not a second selection system - and is
        // wired on a separate listener, not the close button's.
        expect(html).toContain("cycleDetailCloseButton?.addEventListener('click', () => cycleDetailModal?.close());");

        const bodyListenerStart = html.indexOf("cycleDetailBody?.addEventListener('click'");
        const bodyListenerEnd = html.indexOf("cy.on('tap', 'node'", bodyListenerStart);
        const bodyListenerSource = html.slice(bodyListenerStart, bodyListenerEnd);
        expect(bodyListenerSource).toContain('cycleDetailModal?.close();');
        expect(bodyListenerSource).toContain('navigateToSccMember(itemEl.dataset.cycleNavId);');
    });

    it('coexists with the existing educational modal - separate dialog id, both wired independently', () => {
        // Regression guard: adding this second dialog must not repurpose
        // or rename cycle-info-modal's own elements/ids.
        expect(html).toContain("document.getElementById('cycle-info-modal')");
        expect(html).toContain("document.getElementById('cycle-info-btn')");
        expect(html).toContain("document.getElementById('cycle-detail-modal')");
        expect(html.match(/id="cycle-info-modal"/g)).toHaveLength(1);
        expect(html.match(/id="cycle-detail-modal"/g)).toHaveLength(1);
    });

    // UI polish (2026): the flat "text -> chips -> dense list" modal was
    // reworked into header badge + short subtitle + a small boustrophedon
    // flow diagram + a visually separated module list - no change to
    // findCycleThroughNode/detection semantics above. These tests guard
    // the new structure the same way the rest of this describe block
    // guards the algorithm: by asserting source shape, since Jest can't
    // execute this against a live cytoscape instance. The actual rendered
    // result (badge text, chip layout, hover affordances) is verified via
    // headless Chrome against the real large-cycle-app fixture.
    it('the header badge shows the module count without duplicating the SCC size or the old long sentence', () => {
        // Full localization task: the count text now goes through the same
        // scaleModules/scaleModulesSingular dictionary keys the Findings
        // scale text already used, instead of a hand-rolled English
        // singular/plural literal.
        expect(html).toContain('id="cycle-detail-count-badge"');
        expect(html).toContain(
            'cycleDetailCountBadge.textContent = formatI18nClient('
        );
        expect(html).toContain('memberNodes.length === 1 ? dict.scaleModulesSingular : dict.scaleModules');
    });

    it('the start/selected node gets the same accent class everywhere it appears - the flow diagram, the closing line, and the list', () => {
        // One class, reused three times, rather than three different ways
        // of saying "this is the module you selected" - renderCycleChip's
        // own isStart parameter is only ever true for index 0 (the real
        // selected node, never a member.hasClass('area-hidden') check or
        // anything else), and buildCycleListHtml applies the equivalent
        // list-row class under the same index === 0 condition.
        expect(html).toContain('renderCycleChip(node, index === 0)');
        expect(html).toContain("classes.push('cycle-node-start');");
        // Full localization task: "back to" is now dict.cycleFlowBackTo,
        // translated, and the arrow+chip are wrapped in their own
        // dir="ltr" span (see the RTL note above buildCycleFlowHtml) so
        // this real directional indicator never mirrors under Arabic -
        // still the same arrow entity and .cycle-node-start chip class.
        expect(html).toContain('escapeHtml(dict.cycleFlowBackTo)');
        expect(html).toContain('<span class="cycle-arrow">&#8618;</span> <span class="cycle-chip cycle-node-start">');
        expect(html).toContain("const startCls = index === 0 ? ' cycle-detail-item-start' : '';");
    });

    it('the flow diagram lays cells into fixed-size rows and alternates reading direction row to row (a snake/boustrophedon layout)', () => {
        expect(html).toContain('const CYCLE_FLOW_ROW_SIZE = 4;');
        expect(html).toContain('const isReverse = rowIndex % 2 === 1;');
        expect(html).toMatch(/isReverse\s*\?\s*\[\.\.\.rowCells\]\.reverse\(\)\s*:\s*rowCells/);
    });

    it('the closing indicator is a distinct, explicit line - not one more chip silently appended to the last row', () => {
        expect(html).toContain('function buildCycleFlowHtml(memberNodes, startLabel, dict)');
        expect(html).toContain('class="cycle-flow-closing"');
    });

    it('the hidden-filter note uses a calm, non-alarming info style, matching the same blue used for the start/count accents', () => {
        // Wording changed (the old note re-stated the full "This cycle
        // contains N modules" total, now already shown by the header
        // badge/metadata chips) but the guarantee - a filtered-out member
        // is disclosed, never silently dropped from the count - did not.
        expect(html).toContain('hidden by the current filter');
        expect(html).toContain('areaHiddenCount > 0');
        expect(html).toContain('focusHiddenCount > 0');
        expect(html).not.toContain('This cycle contains ${memberNodes.length} modules;');
    });
});

describe('buildHtmlTemplate findings-first overview (Phase 1)', () => {
    // The overview is entirely server-rendered from the same CycleFindings
    // payload Phase 0 introduced (see buildCycleFindings.ts) - unlike most
    // of this file, these assertions check REAL rendered HTML for REAL
    // findings shapes, not client-side source structure, since
    // renderFindingsOverview() runs in Node at generation time (there's no
    // "runs only in a live browser" excuse here the way there is for
    // cytoscape-dependent client code elsewhere in this file).

    it('renders a clear zero state - not just an empty list - when there are no cycles', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: { moduleCount: 8, dependencyCount: 6, sccs: [] },
        });

        expect(html).toContain('No dependency cycles detected.');
        expect(html).toContain('8 modules · 6 dependencies');
        expect(html).toContain('>Explore graph<');
        // The zero-state reads as a deliberate, understood state ("nothing
        // found"), not an empty findings-list with no explanation - no
        // <ol class="findings-list"> should render at all when there's
        // nothing to put in it.
        expect(html).not.toContain('class="findings-list"');
    });

    it('renders one finding for one SCC, with its size and a representative-cycle preview', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 5,
                dependencyCount: 6,
                sccs: [
                    {
                        id: 0,
                        size: 3,
                        memberIds: ['/repo/src/a.ts', '/repo/src/b.ts', '/repo/src/c.ts'],
                        exampleCycle: ['/repo/src/a.ts', '/repo/src/b.ts', '/repo/src/c.ts', '/repo/src/a.ts'],
                    },
                ],
            },
        });

        expect(html).toContain('1 SCC containing cycles');
        expect(html).toContain('SCC #1');
        expect(html).toContain('3 modules');
        expect(html).toContain('a.ts &rarr; b.ts &rarr; c.ts &rarr; a.ts');
        expect(html).toContain('5 modules · 6 dependencies');
    });

    it('renders one row per independent SCC for multiple SCCs, each with its own correct size', () => {
        // large-cycle-app's own real shape: a 7-module ring plus an
        // independent 2-module pair - must never collapse into one row or
        // mix up which size belongs to which.
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 16,
                dependencyCount: 17,
                sccs: [
                    {
                        id: 0,
                        size: 2,
                        memberIds: ['/repo/src/pair/left.ts', '/repo/src/pair/right.ts'],
                        exampleCycle: ['/repo/src/pair/left.ts', '/repo/src/pair/right.ts', '/repo/src/pair/left.ts'],
                    },
                    {
                        id: 1,
                        size: 7,
                        memberIds: Array.from({ length: 7 }, (_, i) => `/repo/src/ring/ring${i}.ts`),
                        exampleCycle: [
                            ...Array.from({ length: 7 }, (_, i) => `/repo/src/ring/ring${i}.ts`),
                            '/repo/src/ring/ring0.ts',
                        ],
                    },
                ],
            },
        });

        expect(html).toContain('2 SCCs containing cycles');
        expect(html).toContain('SCC #1');
        expect(html).toContain('SCC #2');
        expect(html.match(/finding-row-header">SCC #1 &middot; 2 modules/)).toBeTruthy();
        expect(html.match(/finding-row-header">SCC #2 &middot; 7 modules/)).toBeTruthy();
        // Both rows must be present as distinct list items, not merged -
        // scoped to the English block specifically, since the same two
        // SCCs are also rendered (in Finnish/Swedish) elsewhere on the
        // page for the language switcher.
        const englishBlock = extractEnglishFindingsBlock(html);
        expect(englishBlock.match(/class="finding-row"/g)).toHaveLength(2);
    });

    it('P1-3: displays findings sorted by SCC size descending, deterministically tie-broken, while preserving each finding\'s original id', () => {
        // buildCycleFindings() itself assigns id purely by findSCCs()
        // insertion order (an internal algorithm detail with no size
        // relationship - a small SCC can easily come back before a large
        // one, or two equal-size SCCs in an arbitrary order). This is
        // deliberately NOT presorted by size before ids are assigned: id
        // must keep tracking the real sccId a click on this row hands to
        // the graph, so the fix has to reorder ONLY how rows are drawn,
        // never renumber them.
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 20,
                dependencyCount: 20,
                sccs: [
                    {
                        id: 0,
                        size: 2,
                        memberIds: ['/repo/small-a.ts', '/repo/small-b.ts'],
                        exampleCycle: ['/repo/small-a.ts', '/repo/small-b.ts', '/repo/small-a.ts'],
                    },
                    {
                        id: 1,
                        size: 5,
                        memberIds: Array.from({ length: 5 }, (_, i) => `/repo/mid${i}.ts`),
                        exampleCycle: [
                            ...Array.from({ length: 5 }, (_, i) => `/repo/mid${i}.ts`),
                            '/repo/mid0.ts',
                        ],
                    },
                    {
                        id: 2,
                        size: 9,
                        memberIds: Array.from({ length: 9 }, (_, i) => `/repo/big${i}.ts`),
                        exampleCycle: [
                            ...Array.from({ length: 9 }, (_, i) => `/repo/big${i}.ts`),
                            '/repo/big0.ts',
                        ],
                    },
                    {
                        id: 3,
                        size: 2,
                        memberIds: ['/repo/tie-a.ts', '/repo/tie-b.ts'],
                        exampleCycle: ['/repo/tie-a.ts', '/repo/tie-b.ts', '/repo/tie-a.ts'],
                    },
                ],
            },
        });

        const englishBlock = extractEnglishFindingsBlock(html);
        const sccIdOrder = Array.from(
            englishBlock.matchAll(/data-finding-scc-id="(\d+)"/g),
            (match) => Number(match[1])
        );

        // Displayed biggest-first (size 9, 5, then the two size-2 SCCs);
        // the two size-2 SCCs (ids 0 and 3) tie-break deterministically by
        // id ascending, not left in findSCCs()' own insertion order (which
        // already happened to put id 0 first here, so this alone wouldn't
        // catch a broken/unstable tie-break - the real assertion is the
        // overall descending-by-size order below).
        expect(sccIdOrder).toEqual([2, 1, 0, 3]);

        // ids themselves are never renumbered by display order - each row
        // still carries its own real, original sccId.
        expect(englishBlock).toContain('data-finding-scc-id="0"');
        expect(englishBlock).toContain('data-finding-scc-id="1"');
        expect(englishBlock).toContain('data-finding-scc-id="2"');
        expect(englishBlock).toContain('data-finding-scc-id="3"');
    });

    it('P1-3: tie-break stays deterministic when the larger id would naturally sort first in findSCCs() order', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 10,
                dependencyCount: 10,
                sccs: [
                    {
                        id: 0,
                        size: 3,
                        memberIds: ['/repo/first-a.ts', '/repo/first-b.ts', '/repo/first-c.ts'],
                        exampleCycle: [
                            '/repo/first-a.ts',
                            '/repo/first-b.ts',
                            '/repo/first-c.ts',
                            '/repo/first-a.ts',
                        ],
                    },
                    {
                        id: 1,
                        size: 3,
                        memberIds: ['/repo/second-a.ts', '/repo/second-b.ts', '/repo/second-c.ts'],
                        exampleCycle: [
                            '/repo/second-a.ts',
                            '/repo/second-b.ts',
                            '/repo/second-c.ts',
                            '/repo/second-a.ts',
                        ],
                    },
                ],
            },
        });

        const englishBlock = extractEnglishFindingsBlock(html);
        const sccIdOrder = Array.from(
            englishBlock.matchAll(/data-finding-scc-id="(\d+)"/g),
            (match) => Number(match[1])
        );

        expect(sccIdOrder).toEqual([0, 1]);
    });

    it('abbreviates a large representative cycle to start, one hop, and the closing return - never the full chain', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 7,
                dependencyCount: 7,
                sccs: [
                    {
                        id: 0,
                        size: 7,
                        memberIds: Array.from({ length: 7 }, (_, i) => `/repo/src/ring/ring${i}.ts`),
                        exampleCycle: [
                            ...Array.from({ length: 7 }, (_, i) => `/repo/src/ring/ring${i}.ts`),
                            '/repo/src/ring/ring0.ts',
                        ],
                    },
                ],
            },
        });

        expect(html).toContain('ring0.ts &rarr; ring1.ts &rarr; &hellip; &rarr; ring0.ts');
        // The middle members are deliberately never spelled out here (the
        // full sequence is the concrete-cycle modal's job, unchanged) -
        // this list's own row must not itself contain every member label.
        expect(html).not.toContain('ring3.ts &rarr;');
        expect(html).not.toContain('ring6.ts &rarr;');
    });

    it('never presents a shown SCC as itself "a cycle" - SCC identity and size, not cycle language, label each finding', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 3,
                dependencyCount: 3,
                sccs: [
                    {
                        id: 0,
                        size: 3,
                        memberIds: ['/repo/a.ts', '/repo/b.ts', '/repo/c.ts'],
                        exampleCycle: ['/repo/a.ts', '/repo/b.ts', '/repo/c.ts', '/repo/a.ts'],
                    },
                ],
            },
        });

        // The finding is labeled by SCC identity/size ("SCC #1 · 3
        // modules"), never "Cycle #1" or "3-module cycle" - matching the
        // same distinction already established for the concrete-cycle
        // modal and the per-node HUD block.
        expect(html).toContain('SCC #1 &middot; 3 modules');
        expect(html).not.toContain('Cycle #1');
        expect(html).not.toContain('cycle #1');
    });

    it('never implies a shown representative cycle is the only cycle in its SCC', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 3,
                dependencyCount: 3,
                sccs: [
                    {
                        id: 0,
                        size: 3,
                        memberIds: ['/repo/a.ts', '/repo/b.ts', '/repo/c.ts'],
                        exampleCycle: ['/repo/a.ts', '/repo/b.ts', '/repo/c.ts', '/repo/a.ts'],
                    },
                ],
            },
        });

        expect(html).toContain('one representative cycle');
        expect(html).toContain('an SCC may contain others');
        expect(html).not.toContain('the only cycle');
        expect(html).not.toContain('This is the cycle');
    });

    it('shows the module and dependency counts, independent of how many (or few) SCCs exist', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 116,
                dependencyCount: 215,
                sccs: [
                    { id: 0, size: 2, memberIds: ['/repo/a.ts', '/repo/b.ts'], exampleCycle: ['/repo/a.ts', '/repo/b.ts', '/repo/a.ts'] },
                ],
            },
        });

        expect(html).toContain('116 modules · 215 dependencies');
    });

    it('renders correct singular wording for exactly 1 module/1 dependency/1 SCC, not "1 modules"', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 1,
                dependencyCount: 1,
                sccs: [
                    { id: 0, size: 2, memberIds: ['/repo/a.ts', '/repo/b.ts'], exampleCycle: ['/repo/a.ts', '/repo/b.ts', '/repo/a.ts'] },
                ],
            },
        });

        expect(html).toContain('1 module · 1 dependency');
        expect(html).toContain('1 SCC containing cycles');
    });

    it('escapes a crafted file path in a member label - the overview runs at report-generation time, nothing downstream re-sanitizes it', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 2,
                dependencyCount: 2,
                sccs: [
                    {
                        id: 0,
                        size: 2,
                        memberIds: ['/repo/"><script>alert(1)</script>.ts', '/repo/partner.ts'],
                        exampleCycle: [
                            '/repo/"><script>alert(1)</script>.ts',
                            '/repo/partner.ts',
                            '/repo/"><script>alert(1)</script>.ts',
                        ],
                    },
                ],
            },
        });

        expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('renders the Findings view ahead of the Graph view in document order - findings-first, not graph-first', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: { moduleCount: 1, dependencyCount: 0, sccs: [] },
        });

        const findingsIndex = html.indexOf('id="findings-view"');
        const graphIndex = html.indexOf('id="graph-explorer"');

        expect(findingsIndex).toBeGreaterThan(-1);
        expect(graphIndex).toBeGreaterThan(-1);
        expect(findingsIndex).toBeLessThan(graphIndex);
    });

    it('the "explore" button switches to the Graph view - a real UI action (application state, not a URL), not a plain anchor', () => {
        // Information architecture rework: Findings and Graph are now two
        // toggleable views (a CSS-state flip, see switchToView() in
        // template.ts), not two positions on one scrollable page - a
        // plain #-anchor can no longer meaningfully "go to the graph"
        // (the graph section is visibility:hidden until switchToView()
        // runs, see styles.ts), so this is deliberately a <button> wired
        // to real state-changing JS instead of the old anchor link.
        const zero = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });
        expect(zero).toContain('data-action="explore-graph"');
        expect(zero).not.toContain('href="#graph-explorer"');

        const withFindings = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: {
                moduleCount: 2,
                dependencyCount: 2,
                sccs: [{ id: 0, size: 2, memberIds: ['/repo/a.ts', '/repo/b.ts'], exampleCycle: ['/repo/a.ts', '/repo/b.ts', '/repo/a.ts'] }],
            },
        });
        expect(withFindings).toContain('data-action="explore-graph"');
    });
});

describe('buildHtmlTemplate findings-first navigation (Phase 2)', () => {
    // Closes the loop: Findings -> concrete cycle modal -> Focus SCC ->
    // full graph -> (existing, unchanged) graph -> concrete cycle modal.
    // No new graph architecture, no new cycle-detection, no duplicated
    // focusScc/findCycleThroughNode implementation - these tests assert
    // that the new wiring calls the EXISTING functions rather than
    // reimplementing anything, since Jest can't execute this against a
    // live cytoscape instance (see this file's established convention).
    // Real end-to-end behavior (does clicking a finding actually open the
    // right SCC's cycle, does Show in graph actually focus it, do filters
    // stay honest) is verified separately via headless Chrome against the
    // real large-cycle-app fixture.
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    it('a finding row click is wired to openCycleDetailModalForScc via its own data-finding-scc-id, not a new listener per row', () => {
        expect(html).toContain("document.getElementById('findings-view')?.addEventListener('click'");
        expect(html).toContain("event.target.closest('[data-finding-scc-id]')");
        expect(html).toContain('openCycleDetailModalForScc(Number(row.dataset.findingSccId));');
    });

    it('openCycleDetailModalForScc looks members up by sccId only - never by module name/label - and never recomputes a cycle itself', () => {
        const fnStart = html.indexOf('function openCycleDetailModalForScc(sccId)');
        const fnEnd = html.indexOf('hudSelectedBody?.addEventListener', fnStart);
        const fnSource = html.slice(fnStart, fnEnd);

        expect(fnStart).toBeGreaterThan(-1);
        expect(fnSource).toContain("candidate.data('sccId') === sccId");
        expect(fnSource).not.toContain('label');
        // The only new logic is picking WHICH member to hand to the
        // existing openCycleDetailModal(nodeId) - a plain sort, not a
        // cycle-finding algorithm (no BFS/queue/adjacency of its own).
        expect(fnSource).not.toContain('cameFrom');
        expect(fnSource).not.toContain('adjacency');
        expect(fnSource).toContain('.sort();');
        expect(fnSource).toContain('openCycleDetailModal(memberIds[0]);');
    });

    it('openCycleDetailModalForScc picks the same deterministic start buildCycleFindings.ts already used server-side - the alphabetically smallest member', () => {
        // Guarantees the modal opened from a finding shows the exact same
        // cycle already previewed in the findings list, not a different
        // arbitrary one - both this client-side pick and the server's own
        // exampleCycle start use the identical rule (sort ascending, take
        // the first).
        const fnStart = html.indexOf('function openCycleDetailModalForScc(sccId)');
        const fnEnd = html.indexOf('hudSelectedBody?.addEventListener', fnStart);
        const fnSource = html.slice(fnStart, fnEnd);

        expect(fnSource).toMatch(/\.map\(\(candidate\) => candidate\.id\(\)\)\s*\.sort\(\);/);
    });

    it('"Show in graph" inside the concrete-cycle modal reuses focusScc(sccId, startId) unchanged - not a second focus implementation', () => {
        expect(html).toContain('class="cycle-detail-focus-btn"');
        expect(html).toContain('data-focus-scc-id="${sccId}"');
        expect(html).toContain('data-focus-start-id="${escapeAttribute(node.id())}"');
        expect(html).toContain('focusScc(Number(focusEl.dataset.focusSccId), focusEl.dataset.focusStartId);');

        // The button calling it lives inside openCycleDetailModal's own
        // template literal, not a competing/duplicate focus function.
        const focusSccOccurrences = html.match(/function focusScc\(sccId, startId\)/g);
        expect(focusSccOccurrences).toHaveLength(1);
    });

    it('"Show in graph" is honest about partial visibility - gated on the WHOLE SCC\'s visible member count, matching the HUD\'s own Focus SCC rule', () => {
        // Full localization task: the label text now comes from
        // I18N_DICTIONARIES (dict.showInGraphButton + a formatted
        // moduleCountVisibleParen suffix), matching the same "of N" rule
        // the HUD's own Focus SCC button already uses.
        expect(html).toContain('const visibleSccMemberCount = cy');
        expect(html).toContain("candidate.data('sccId') === sccId && !candidate.hasClass('area-hidden')");
        expect(html).toContain('visibleSccMemberCount >= 2');
        expect(html).toContain(
            "dict.showInGraphButton + ' ' + formatI18nClient(dict.moduleCountVisibleParen, { visible: visibleSccMemberCount, n: sccSize })"
        );
    });

    it('"Show in graph" closes the modal and switches to the Graph view, since the user may be looking at the Findings view when they click it', () => {
        const focusElBlockStart = html.indexOf('const focusEl = event.target.closest');
        const focusElBlockEnd = html.indexOf('const itemEl = event.target.closest', focusElBlockStart);
        const focusElBlock = html.slice(focusElBlockStart, focusElBlockEnd);

        expect(focusElBlockStart).toBeGreaterThan(-1);
        expect(focusElBlock).toContain('cycleDetailModal?.close();');
        expect(focusElBlock).toContain('focusScc(Number(focusEl.dataset.focusSccId), focusEl.dataset.focusStartId);');
        expect(focusElBlock).toContain("switchToView('graph');");
    });

    it('the existing direct-node-click -> HUD -> concrete-cycle-modal workflow is untouched', () => {
        // Regression guard for the already-existing flow this task must
        // not break: clicking "Show a dependency cycle" in the per-node
        // HUD block still calls openCycleDetailModal directly with the
        // clicked node's own id - unchanged from before this task.
        expect(html).toContain("const cycleButtonEl = event.target.closest('[data-show-cycle-node-id]');");
        expect(html).toContain('openCycleDetailModal(cycleButtonEl.dataset.showCycleNodeId);');
    });

    it('findCycleThroughNode itself is untouched by this task - still the one, unduplicated cycle-finding implementation', () => {
        const occurrences = html.match(/function findCycleThroughNode\(sccId, startId\)/g);
        expect(occurrences).toHaveLength(1);
    });
});

describe('buildHtmlTemplate initial graph view (UX fix, pre-existing behavior - not a Findings regression)', () => {
    // Pre-existing bug (confirmed by reproducing the identical zoom/pan
    // values on master before any Findings Phase 0/1/2 work existed):
    // applyInitialView() used to fall back to cy.zoom(1) +
    // cy.center(currentView) whenever the graph didn't "fit comfortably" -
    // for a tall, narrow vertical-flow layout (a cycle's members each
    // land on a different rank), that centers the viewport on mostly
    // empty vertical space, showing almost nothing at first load. Fixed
    // by always using the exact same fit-to-viewport call "Fit Graph"
    // already makes - no second implementation, no new heuristic/
    // threshold, no layout change.
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    it('applyInitialView always uses the same fit-to-viewport logic as the "Fit Graph" button - no separate zoom(1)/center() fallback', () => {
        const fnStart = html.indexOf('function applyInitialView(cy)');
        const fnEnd = html.indexOf('}', fnStart);
        const fnSource = html.slice(fnStart, fnEnd);

        expect(fnStart).toBeGreaterThan(-1);
        expect(fnSource).toContain('fitCyAvoidingChrome(cy, 80);');
        expect(fnSource).not.toContain('cy.zoom(1)');
        expect(fnSource).not.toContain('cy.center(');
    });

    it('removes the now-dead "fits comfortably" branch and its threshold entirely, rather than leaving unreachable code behind', () => {
        expect(html).not.toContain('FIT_TOLERANCE');
        expect(html).not.toContain('fitsComfortably');
    });

    it('the manual "Fit Graph" button keeps its own existing behavior unchanged', () => {
        // Regression guard: the button's own call uses a different base
        // padding (40) than the initial view's (80) - confirmed still
        // distinct, i.e. this fix didn't accidentally merge the two
        // call sites into one shared constant/behavior change.
        const fitBtnStart = html.indexOf("fitButton.addEventListener(");
        const fitBtnEnd = html.indexOf('});', fitBtnStart);
        const fitBtnSource = html.slice(fitBtnStart, fitBtnEnd);

        expect(fitBtnStart).toBeGreaterThan(-1);
        expect(fitBtnSource).toContain('fitCyAvoidingChrome(cy, 40);');
    });

    it('fitCyAvoidingChrome itself (the shared chrome-avoiding fit math) is untouched - still the one implementation, reused, not duplicated', () => {
        const occurrences = html.match(/function fitCyAvoidingChrome\(cy, basePadding, targetCollection\)/g);
        expect(occurrences).toHaveLength(1);
    });
});

describe('buildHtmlTemplate Findings/Graph views + language switcher (information architecture rework)', () => {
    // Findings and Graph are now two toggleable views inside one
    // standalone page (a CSS-state flip via switchToView(), see
    // template.ts), not two positions on one long scrollable page. These
    // tests assert source structure (Jest can't execute this against a
    // live cytoscape instance) plus the exact shape of the embedded i18n
    // data; real switching/rendering behavior is verified separately via
    // headless Chrome against the real large-cycle-app fixture, including
    // a standalone (no assets/, no source project) check.
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    const ALL_LANGUAGES = ['en', 'fi', 'sv', 'no', 'da', 'is', 'de', 'fr', 'es', 'pl', 'pt', 'ru', 'ar', 'ja'];

    it('production language support is exactly the 14 languages - no more, no fewer', () => {
        const match = html.match(/const SUPPORTED_LANGUAGE_CODES = (\[[^\]]*\]);/);
        expect(match).toBeTruthy();
        const codes = JSON.parse(match![1]!);
        expect(codes).toEqual(ALL_LANGUAGES);

        const dictMatch = html.match(/const I18N_DICTIONARIES = (\{.*?\});\s*\n\s*const LANGUAGE_STORAGE_KEY/s);
        expect(dictMatch).toBeTruthy();
        const dict = JSON.parse(dictMatch![1]!);
        expect(Object.keys(dict).sort()).toEqual([...ALL_LANGUAGES].sort());
    });

    it('English is the default language - rendered visible, all 13 others rendered pre-hidden, in SUPPORTED_LANGUAGES order', () => {
        let previousIndex = -1;

        for (const lang of ALL_LANGUAGES) {
            const index = html.indexOf(`data-lang="${lang}"`);
            expect(index).toBeGreaterThan(previousIndex);
            previousIndex = index;

            const tagEnd = html.indexOf('>', index);
            const openingTag = html.slice(index, tagEnd);

            if (lang === 'en') {
                expect(openingTag).not.toContain('hidden');
            } else {
                expect(openingTag).toContain('hidden');
            }
        }
    });

    it('renders a persistent header with Findings/Graph tabs and a language select with exactly 14 options', () => {
        expect(html).toContain('id="app-header"');
        expect(html).toContain('data-view="findings"');
        expect(html).toContain('data-view="graph"');
        expect(html).toContain('id="language-select"');
        expect(html.match(/<option value="(en|fi|sv|no|da|is|de|fr|es|pl|pt|ru|ar|ja)">/g)).toHaveLength(14);
    });

    it('every language renders its own findings title - no missing translation falls back to English text under a different data-lang', () => {
        for (const lang of ALL_LANGUAGES) {
            const start = html.indexOf(`data-lang="${lang}"`);
            const nextLangStart = html.indexOf('data-lang="', start + 1);
            const block = html.slice(start, nextLangStart === -1 ? html.length : nextLangStart);

            // Every block has a real, non-empty <h1> title - proof the
            // dictionary lookup for this language actually resolved to
            // something, not an empty/undefined string silently rendered.
            const titleMatch = block.match(/<h1>([^<]+)<\/h1>/);
            expect(titleMatch).toBeTruthy();
            expect(titleMatch![1]!.trim().length).toBeGreaterThan(0);
        }
    });

    it('Arabic\'s findings block carries dir="rtl", server-rendered - every other language\'s does not', () => {
        for (const lang of ALL_LANGUAGES) {
            const index = html.indexOf(`data-lang="${lang}"`);
            const tagEnd = html.indexOf('>', index);
            const openingTag = html.slice(index, tagEnd);

            if (lang === 'ar') {
                expect(openingTag).toContain('dir="rtl"');
            } else {
                expect(openingTag).not.toContain('dir="rtl"');
            }
        }
    });

    it('RTL is scoped to the Findings surfaces only - never applied to <html>/<body> or the Graph view, so the dependency graph itself never mirrors', () => {
        expect(html).not.toMatch(/<html[^>]*\bdir=/);
        expect(html).not.toMatch(/<body[^>]*\bdir=/);
        expect(html).not.toMatch(/id="graph-explorer"[^>]*\bdir=/);
        expect(html).not.toMatch(/id="bottom-hud"[^>]*\bdir=/);
    });

    it('applyLanguage toggles dir="rtl" on #app-header specifically for Arabic - the header is not pre-rendered per language, unlike the findings blocks', () => {
        // Full localization task: isRtl is now computed once and reused
        // for #app-header AND the newly-localized Graph chrome panels
        // (#hint/#toolbar/#bottom-hud/both modals) below it, rather than
        // each caller re-evaluating RTL_LANGUAGE_CODES.includes(lang).
        const isRtlLineIndex = html.indexOf('const isRtl = RTL_LANGUAGE_CODES.includes(lang);');
        const appHeaderBlockStart = html.indexOf("const appHeader = document.getElementById('app-header');");
        const appHeaderBlockEnd = html.indexOf("['hint', 'toolbar'", appHeaderBlockStart);
        const block = html.slice(appHeaderBlockStart, appHeaderBlockEnd);

        expect(isRtlLineIndex).toBeGreaterThan(-1);
        expect(isRtlLineIndex).toBeLessThan(appHeaderBlockStart);
        expect(appHeaderBlockStart).toBeGreaterThan(-1);
        expect(block).toContain('if (isRtl) {');
        expect(block).toContain("appHeader.setAttribute('dir', 'rtl')");
        expect(block).toContain('appHeader.removeAttribute(\'dir\')');
    });

    it('applyLanguage also toggles dir="rtl" on the localized Graph chrome panels, but never on #graph-explorer/#cy or the minimap - the dependency graph itself must never mirror', () => {
        expect(html).toContain(
            "['hint', 'toolbar', 'bottom-hud', 'cycle-info-modal', 'cycle-detail-modal'].forEach("
        );
        expect(html).not.toMatch(/\[('|")hint('|")[\s\S]{0,200}'graph-explorer'/);
    });

    it('RTL_LANGUAGE_CODES embedded client-side contains exactly Arabic', () => {
        const match = html.match(/const RTL_LANGUAGE_CODES = (\[[^\]]*\]);/);
        expect(match).toBeTruthy();
        expect(JSON.parse(match![1]!)).toEqual(['ar']);
    });

    it('switchToView toggles Findings/Graph via CSS classes only - never destroys or recreates the graph', () => {
        const fnStart = html.indexOf('function switchToView(view)');
        const fnEnd = html.indexOf('document.querySelectorAll(\'.view-tab\').forEach((tab) => {\n                tab.addEventListener', fnStart);
        const fnSource = html.slice(fnStart, fnEnd);

        expect(fnStart).toBeGreaterThan(-1);
        expect(fnSource).toContain("classList.toggle('is-hidden', isGraph)");
        expect(fnSource).toContain("classList.toggle('is-active', isGraph)");
        // Never rebuilds cytoscape, never re-fetches/re-renders findings.
        expect(fnSource).not.toContain('cytoscape(');
        expect(fnSource).not.toContain('innerHTML');
    });

    it('the Graph view is hidden via visibility, never display:none - a zero-size container would corrupt the initial fit/zoom math', () => {
        expect(html).toContain('#graph-explorer {');
        expect(html).toContain('#graph-explorer.is-active {\n        visibility: visible;\n    }');
        expect(html).toContain('#bottom-hud.is-active {\n        visibility: visible;\n    }');

        const graphExplorerRuleStart = html.indexOf('#graph-explorer {');
        const graphExplorerRuleEnd = html.indexOf('}', graphExplorerRuleStart);
        expect(html.slice(graphExplorerRuleStart, graphExplorerRuleEnd)).not.toContain('display: none');
    });

    it('the Findings view IS hidden via plain display:none when Graph is active - safe, since nothing inside it is a canvas/measurement-sensitive library', () => {
        expect(html).toContain('#findings-view.is-hidden {\n        display: none;\n    }');
    });

    it('localStorage access for the saved language is wrapped defensively - private browsing must not break language switching itself', () => {
        expect(html).toContain('localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);');
        expect(html).toContain('localStorage.getItem(LANGUAGE_STORAGE_KEY);');

        const getInitialStart = html.indexOf('function getInitialLanguage()');
        const getInitialEnd = html.indexOf('function applyLanguage', getInitialStart);
        // applyLanguage is defined BEFORE getInitialLanguage in source
        // order - fall back to searching forward instead if that lookup
        // failed (defensive against reordering, not a real expectation
        // either way).
        const searchEnd = getInitialEnd > -1 ? getInitialEnd : html.indexOf('document.getElementById(\'language-select\')', getInitialStart);
        const source = html.slice(getInitialStart, searchEnd);

        expect(getInitialStart).toBeGreaterThan(-1);
        expect(source).toContain('try {');
        expect(source).toContain('catch');
    });

    it('does not introduce any external script/stylesheet dependency - still exactly the three existing local graph assets', () => {
        // Standalone-HTML requirement: the language switcher and its
        // dictionaries must work fully offline. No CDN, no i18n library,
        // no new <script src="http...">.
        const scriptSrcs = html.match(/<script src="[^"]*"/g) ?? [];
        expect(scriptSrcs).toEqual([
            '<script src="./assets/cytoscape.min.js"',
            '<script src="./assets/dagre.min.js"',
            '<script src="./assets/cytoscape-dagre.js"',
        ]);
        expect(html).not.toContain('http://');
        expect(html).not.toContain('https://');
    });

    it('"Show a dependency cycle" from a direct graph node click still works while already in the Graph view - no view switch needed there', () => {
        // Regression guard: only entry points that ORIGINATE from
        // Findings (or need to return to the graph after being opened
        // from Findings) call switchToView() - a click that starts and
        // ends inside the Graph view must not gain a spurious view
        // switch.
        expect(html).toContain("const cycleButtonEl = event.target.closest('[data-show-cycle-node-id]');");
        const hudListenerIndex = html.indexOf("const cycleButtonEl = event.target.closest");
        const hudListenerBlockEnd = html.indexOf('});', hudListenerIndex);
        expect(html.slice(hudListenerIndex, hudListenerBlockEnd)).not.toContain('switchToView');
    });
});

describe('buildHtmlTemplate Full Graph centering / minimap viewport-rect (viewport bug fixes)', () => {
    // Both bugs, and their fixes, are viewport/fit MATH issues that only
    // show up with real rendered element sizes and a real cytoscape
    // instance - Jest can't execute this client-side script against a
    // live DOM/cytoscape, so these assert source structure (the specific
    // formula/guard/sharing exists, the specific broken one doesn't)
    // rather than a rendered/measured result. The actual numeric
    // behavior (graph horizontally centered, minimap rect always within
    // its own canvas bounds, exact pan/zoom restore on "Back to full
    // graph") is verified separately via headless Chrome against several
    // real fixtures and window sizes.
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    it('measureChromeInsets treats #hint as a LEFT inset (its fixed width) and #toolbar as a TOP inset (its short height) - not the other way around', () => {
        // P0 fix (final pre-release audit): #hint now renders the Module
        // area legend, one row per area actually present on the scanned
        // project - #hint.bottom - containerRect.top (the old top-inset
        // formula this test used to require) can reach several hundred px
        // for a project with a dozen-plus areas, collapsing
        // fitCyAvoidingChrome's availableHeight to near zero or negative
        // (the audit's reported "Full Graph zoom ~0.001, graph effectively
        // gone" failure). #hint's WIDTH stays fixed regardless of legend
        // length (see styles.ts: width: 300px), so the fit now avoids
        // #hint's own column via a LEFT inset instead - bounded no matter
        // how tall the legend grows. #toolbar has no equivalent growth (it
        // wraps horizontally rather than stacking rows - see its own
        // max-width comment, sized to always leave #hint's column clear),
        // so it keeps contributing to topInset exactly as before.
        const fnStart = html.indexOf('function measureChromeInsets(container)');
        const fnEnd = html.indexOf('function fitCyAvoidingChrome(');
        const fnSource = html.slice(fnStart, fnEnd);

        expect(fnStart).toBeGreaterThan(-1);
        expect(fnSource).toContain('hint.right - containerRect.left');
        expect(fnSource).not.toContain('hint.bottom');
        expect(fnSource).toContain('toolbar.bottom - containerRect.top');
        expect(fnSource).not.toContain('toolbar.left');
        expect(fnSource).not.toContain('toolbar.right');
    });

    it('measureChromeInsets no longer measures #minimap-container at all - it structurally cannot overlap the canvas', () => {
        // #minimap-container lives inside #bottom-hud, a separate fixed
        // bar BELOW #graph-explorer/#cy (#graph-explorer's own height
        // already excludes --bottom-hud-height in styles.ts) - its old
        // "right"/"bottom" contributions here were already dead code
        // (bottom always came out negative, clamped to 0, since
        // minimap.top already sits past containerRect.bottom).
        const fnStart = html.indexOf('function measureChromeInsets(container)');
        const fnEnd = html.indexOf('function fitCyAvoidingChrome(');
        const fnSource = html.slice(fnStart, fnEnd);

        expect(fnSource).not.toContain("rectOf('minimap-container')");
        expect(fnSource).not.toContain('minimap.left');
        expect(fnSource).not.toContain('minimap.top');
    });

    it('fitCyAvoidingChrome and applyInitialView are otherwise unchanged - the fix is entirely inside measureChromeInsets', () => {
        // Scope guard: the bug was in what counts as "chrome", not in how
        // the fit rectangle/zoom/pan are computed from those insets, and
        // not in the hierarchical layout - dagre itself, wrapWideRanks,
        // and resolveEdgeNodeOverlaps are untouched by this fix.
        expect(html).toContain('const zoom = Math.min(availableWidth / bb.w, availableHeight / bb.h);');
        expect(html).toContain('const safeCenterX = leftInset + availableWidth / 2;');
        expect(html).toContain('function applyInitialView(cy) {');
    });

    it('getMinimapViewportRect clamps the mapped cy.extent() rectangle to the minimap canvas bounds', () => {
        // The bug: cy.extent() (the model-space region the main canvas
        // shows) can be - and routinely is, once a tall/narrow
        // hierarchical layout is zoomed out to fit a wide/short canvas -
        // much larger than the graph's own content bounding box that
        // computeMinimapTransform() scaled to fit the minimap. Mapped
        // unclamped, the "you are here" rectangle extended past the
        // minimap canvas's own physical edges: meaningless when drawn,
        // and worse for hit-testing, since an unclamped rectangle
        // exceeding the 220x160 canvas made EVERY click on the minimap
        // register as "inside the viewport", silently breaking "click
        // empty minimap space to pan there".
        expect(html).toContain('function getMinimapViewportRect(cy)');
        expect(html).toMatch(/x1:\s*Math\.max\(0, Math\.min\(MINIMAP_WIDTH, a\.x\)\)/);
        expect(html).toMatch(/y1:\s*Math\.max\(0, Math\.min\(MINIMAP_HEIGHT, a\.y\)\)/);
        expect(html).toMatch(/x2:\s*Math\.max\(0, Math\.min\(MINIMAP_WIDTH, b\.x\)\)/);
        expect(html).toMatch(/y2:\s*Math\.max\(0, Math\.min\(MINIMAP_HEIGHT, b\.y\)\)/);
    });

    it('redrawMinimapViewport and isInsideViewportRect both use getMinimapViewportRect - drawing and hit-testing can never drift apart', () => {
        const drawFnStart = html.indexOf('function redrawMinimapViewport(cy)');
        const drawFnEnd = html.indexOf('function panCyToGraphPoint(');
        const hitTestFnStart = html.indexOf('function isInsideViewportRect(cy, mx, my)');
        const hitTestFnEnd = html.indexOf('if (minimapCanvas)', hitTestFnStart);

        expect(drawFnStart).toBeGreaterThan(-1);
        expect(hitTestFnStart).toBeGreaterThan(-1);
        expect(html.slice(drawFnStart, drawFnEnd)).toContain('getMinimapViewportRect(cy)');
        expect(html.slice(hitTestFnStart, hitTestFnEnd)).toContain('getMinimapViewportRect(cy)');

        // Neither function re-derives cy.extent()/toMinimapPoint() math of
        // its own anymore - there is exactly one place that does.
        expect(html.match(/const extent = cy\.extent\(\);/g)).toHaveLength(1);
    });

    it('focusScc\'s pre-focus snapshot defensively copies cy.pan() - it is a live reference, not a value, in this cytoscape version', () => {
        // Bug fix: cy.pan() (no args) returns cytoscape's OWN internal
        // pan object BY REFERENCE, not a defensive copy (confirmed
        // directly against the real library: two calls return the exact
        // same object, and mutating via cy.pan({...}) changes what an
        // earlier-captured reference reads too). Without Object.assign
        // here, the "snapshot" was really just an alias to cytoscape's
        // live pan state, so runFocusLayout()'s own fitCyAvoidingChrome()
        // call (repositioning the view for the focused subgraph)
        // silently overwrote the snapshot in place - exitFocus() then
        // "restored" pan to wherever focus itself had just panned to,
        // not to the real pre-focus position. zoom never needed this -
        // cy.zoom() returns a primitive number, copied by value
        // automatically - which is exactly why only zoom, not pan,
        // silently kept working before this fix.
        const focusFnStart = html.indexOf('function focusScc(sccId, startId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        const focusFnSource = html.slice(focusFnStart, focusFnEnd);

        expect(focusFnSource).toContain('pan: Object.assign({}, cy.pan())');
        expect(focusFnSource).not.toMatch(/pan:\s*cy\.pan\(\),/);
    });
});

describe('buildHtmlTemplate overlap-resolution scalability (P0-2 fix)', () => {
    const html = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

    it('embeds the exact, unit-tested/benchmarked resolveEdgeNodeOverlaps/resolveNodeOverlaps from graphOverlapResolution.ts verbatim, not a client-side reimplementation', () => {
        expect(html).toContain(resolveEdgeNodeOverlaps.toString());
        expect(html).toContain(resolveNodeOverlaps.toString());
    });

    it('embeds the exact, unit-tested threshold functions verbatim - the same functions graphOverlapResolution.test.ts exercises directly', () => {
        expect(html).toContain(edgeNodeOverlapIterationsFor.toString());
        expect(html).toContain(nodeOverlapIterationsFor.toString());
    });

    it('the cytoscape-facing resolveEdgeNodeOverlaps(cy, options) wrapper snapshots visibleNodes(cy)/visibleEdges(cy) ONCE, not per-edge inside an iteration loop - the actual P0-2 root cause fix', () => {
        const wrapperStart = html.indexOf('function resolveEdgeNodeOverlaps(cy, options)');
        const wrapperEnd = html.indexOf('function resolveNodeOverlaps(cy, options)');
        expect(wrapperStart).toBeGreaterThan(-1);
        const wrapperSource = html.slice(wrapperStart, wrapperEnd);

        expect(wrapperSource).toContain('const plainNodes = visibleNodes(cy).map(');
        expect(wrapperSource).toContain('const plainEdges = visibleEdges(cy).map(');
        // Exactly one call each - not one per edge/iteration.
        expect(wrapperSource.match(/visibleNodes\(cy\)/g)).toHaveLength(1);
        expect(wrapperSource.match(/visibleEdges\(cy\)/g)).toHaveLength(1);
    });

    it('both cytoscape-facing wrappers write converged positions back in a single cy.batch(), not one .position() call per push', () => {
        const edgeNodeWrapperStart = html.indexOf('function resolveEdgeNodeOverlaps(cy, options)');
        const nodeOverlapWrapperStart = html.indexOf('function resolveNodeOverlaps(cy, options)');
        const nextFnStart = html.indexOf('function ', nodeOverlapWrapperStart + 1);
        const bothWrappersSource = html.slice(edgeNodeWrapperStart, nextFnStart);

        expect(bothWrappersSource.match(/cy\.batch\(\(\) => \{/g)).toHaveLength(2);
    });

    it('the pure algorithm functions are embedded via a differently-named const, never colliding with the cytoscape-facing wrapper of the same name', () => {
        expect(html).toContain('const resolveEdgeNodeOverlapsPure = ');
        expect(html).toContain('const resolveNodeOverlapsPure = ');
        // Exactly one real function DECLARATION per name in the whole
        // script - the pure versions are function EXPRESSIONS assigned to
        // a const, never a second `function resolveEdgeNodeOverlaps(...)`
        // declaration alongside the cytoscape-facing wrapper.
        expect(html.match(/function resolveEdgeNodeOverlaps\(cy, options\)/g)).toHaveLength(1);
        expect(html.match(/function resolveNodeOverlaps\(cy, options\)/g)).toHaveLength(1);
    });

    // F9 regression. The node style is 'width': 'label', 'height': 'label',
    // 'padding': '10px' - node.width()/node.height() return the label box
    // WITHOUT that padding (or any border), so the pure algorithm above
    // (correct on the {width, height} it's given - see
    // graphOverlapResolution.test.ts) resolves overlap against boxes ~20px
    // per dimension smaller than what actually gets rendered, leaving the
    // real, rendered boxes still overlapping even though the algorithm
    // itself reports success. node.outerWidth()/outerHeight() include
    // padding and border and are the correct measurement for this style.
    it('F9 fix: both cytoscape-facing wrappers measure the real rendered node box (outerWidth/outerHeight), not the naked label box excluding padding/border', () => {
        const edgeNodeWrapperStart = html.indexOf('function resolveEdgeNodeOverlaps(cy, options)');
        const nodeOverlapWrapperStart = html.indexOf('function resolveNodeOverlaps(cy, options)');
        const nextFnStart = html.indexOf('function ', nodeOverlapWrapperStart + 1);
        const bothWrappersSource = html.slice(edgeNodeWrapperStart, nextFnStart);

        expect(bothWrappersSource.match(/width: node\.outerWidth\(\)/g)).toHaveLength(2);
        expect(bothWrappersSource.match(/height: node\.outerHeight\(\)/g)).toHaveLength(2);
        expect(bothWrappersSource).not.toContain('width: node.width()');
        expect(bothWrappersSource).not.toContain('height: node.height()');
    });
});

describe('buildHtmlTemplate unresolved imports (F1)', () => {
    it('shows the unresolved specifier and an incomplete-analysis indicator when unresolvedImports is non-empty', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: EMPTY_FINDINGS,
            unresolvedImports: [{ file: '/project/src/a.ts', specifier: './missing' }],
        });

        expect(html).toContain('./missing');
        expect(html).toMatch(/incomplete/i);
    });

    it('shows both entries and their own files when there are multiple unresolved imports', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: EMPTY_FINDINGS,
            unresolvedImports: [
                { file: '/project/src/a.ts', specifier: './missing-a' },
                { file: '/project/src/b.ts', specifier: './missing-b' },
            ],
        });

        expect(html).toContain('./missing-a');
        expect(html).toContain('./missing-b');
    });

    it('shows no incomplete-analysis indicator when unresolvedImports is empty or omitted', () => {
        const withEmptyArray = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: EMPTY_FINDINGS,
            unresolvedImports: [],
        });
        const withOmittedField = buildHtmlTemplate({ nodes: [], edges: [], findings: EMPTY_FINDINGS });

        expect(withEmptyArray).not.toMatch(/incomplete/i);
        expect(withOmittedField).not.toMatch(/incomplete/i);
    });

    // F30: mirrors the exact defect F17 already fixed for the CLI/report
    // metrics display (see metrics/report.ts's own displayName()) - a bare
    // path.basename(entry.file) collides for two files that share a
    // filename in different directories, making it impossible to tell
    // which module an unresolved import actually belongs to.
    it('shows an unambiguous path for each entry, not a same-basename-colliding bare filename, when two unresolved-import files share a filename', () => {
        const html = buildHtmlTemplate({
            nodes: [],
            edges: [],
            findings: EMPTY_FINDINGS,
            unresolvedImports: [
                { file: '/project/src/foo/index.ts', specifier: './missing' },
                { file: '/project/src/bar/index.ts', specifier: './missing' },
            ],
        });

        expect(html).toContain('foo/index.ts');
        expect(html).toContain('bar/index.ts');
        // The bug this guards against: both entries collapse to the exact
        // same bare "index.ts" label, with nothing left to tell them apart.
        expect(html.match(/<code>index\.ts<\/code>/g)).toBeNull();
    });
});
