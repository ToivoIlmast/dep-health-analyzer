import { buildHtmlTemplate } from './template';
import type { CytoscapeEdge, CytoscapeNode } from '../adapters';

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

        const html = buildHtmlTemplate({ nodes, edges });

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
        const html = buildHtmlTemplate({ nodes: [], edges: [] });

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

        const html = buildHtmlTemplate({ nodes, edges });

        expect(html).toContain('src/a.ts');
        expect(html).toContain('"label":"a.ts"');
    });

    it('defines a client-side escapeHtml helper used before setting tooltip innerHTML', () => {
        const html = buildHtmlTemplate({ nodes: [], edges: [] });

        expect(html).toContain('function escapeHtml(value)');
        expect(html).toContain('escapeHtml(title)');
        expect(html).toContain('escapeHtml(data.id)');
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
    const html = buildHtmlTemplate({ nodes: [], edges: [] });

    it('the per-node SCC context block describes an SCC, not "a cycle"', () => {
        expect(html).toContain('strongly connected component (SCC #');
        expect(html).toContain('This SCC contains one or more dependency cycles.');
        expect(html).toContain("'Other modules in this SCC: '");
    });

    it('never claims a group of SCC members IS a single detected cycle', () => {
        expect(html).not.toContain('Other modules in this cycle');
        expect(html).not.toContain('Detected cycle (SCC #');
        expect(html).not.toContain('is what this report highlights as a detected cycle');
    });

    it('the educational modal explains that an SCC is not itself one cycle', () => {
        expect(html).toContain('<h3>What is an SCC?</h3>');
        expect(html).toContain('an SCC is not itself a');
        expect(html).toContain('single cycle');
        expect(html).toContain('<h3>How to investigate a detected SCC</h3>');
    });

    it('preserves the architectural-awareness emphasis line, extended to cover SCC', () => {
        expect(html).toContain('A detected cycle or SCC is not automatically an architectural violation.');
    });
});

describe('buildHtmlTemplate global SCC summary', () => {
    const html = buildHtmlTemplate({ nodes: [], edges: [] });

    it('computes the summary from cy\'s own existing node data, not a second SCC detection', () => {
        // No new analysis: this must read the exact same per-node fields
        // (data(sccId)/data(sccSize)) buildCycleContextHtml already reads,
        // via cy.nodes() - never re-deriving membership from edges/graph
        // structure on the client.
        expect(html).toContain('function computeSccSummary(cy)');
        expect(html).toContain("node.data('sccId')");
        expect(html).toContain("node.data('sccSize')");
    });

    it('shows a neutral empty state instead of a fabricated "0 cycles"', () => {
        expect(html).toContain('No dependency SCCs detected.');
    });

    it('never phrases the SCC summary as a cycle count', () => {
        // The whole point of the earlier terminology fix: SCC count is not
        // cycle count (one SCC can contain more than one cycle). Neither
        // wording direction ("N cycles detected" / "N SCCs" mislabeled as
        // cycles) should ever appear for this summary.
        expect(html.toLowerCase()).not.toContain('cycles detected');
        expect(html).toContain('Detected SCCs:');
    });

    it('excludes a trivial 1-module component from the count, defense in depth', () => {
        // buildCytoscapeElements.ts's realSccs filter (scc.length > 1)
        // already guarantees sccId is never set for a 1-module component,
        // but computeSccSummary must not blindly trust that forever - this
        // asserts the client-side guard exists independently.
        expect(html).toContain('sccSize >= 2');
    });

    it('states on-screen that the count covers the whole analyzed graph, not the current filter', () => {
        // Area/Connections filters never remove real nodes from cy (only
        // toggle a display:none class) and never touch sccId/sccSize, so
        // computeSccSummary(cy) - reading cy.nodes(), not visibleNodes(cy)
        // - already describes the full graph by construction. This
        // assertion is the guard against that silently becoming untrue:
        // if a future change ever makes the summary filter-aware, this
        // exact caption must be updated in the same change, not left
        // claiming "entire analyzed graph" for a now-filtered number.
        expect(html).toContain('entire analyzed graph, not the current filtered view');
        expect(html).toContain('cy.nodes()');
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
        const html = buildHtmlTemplate({ nodes: [], edges: [] });

        expect(html).toContain('function selectNode(node)');
        expect(html).toMatch(/cy\.on\('tap', 'node', \(event\) => \{\s*selectNode\(event\.target\);\s*\}\)/);
        expect(html).toContain('selectedNodeId = data.id;');
        // Only ONE assignment site for selectedNodeId to a real node's id -
        // guards against a future change accidentally duplicating the
        // selection logic instead of reusing selectNode().
        expect(html.match(/selectedNodeId = data\.id;/g)).toHaveLength(1);
    });

    it('navigateToSccMember looks nodes up by their real, stable cytoscape id - never by label/path text', () => {
        const html = buildHtmlTemplate({ nodes: [], edges: [] });

        expect(html).toContain('function navigateToSccMember(nodeId)');
        expect(html).toContain('cy.getElementById(nodeId)');
        expect(html).toContain('cy.center(node)');
        expect(html).toContain('selectNode(node)');
    });

    it('delegates the click handler on the HUD panel itself, since its innerHTML is fully replaced on every selection', () => {
        const html = buildHtmlTemplate({ nodes: [], edges: [] });

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
        const html = buildHtmlTemplate({ nodes: ring, edges: [] });

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
        const html = buildHtmlTemplate({ nodes: pair, edges: [] });

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
        const html = buildHtmlTemplate({ nodes: [plain], edges: [] });

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
        const html = buildHtmlTemplate({ nodes: [], edges: [] });

        expect(html).toContain('data.sccSize < 2 || data.sccId === undefined');
    });

    it('a member hidden by the Area/Connections filter renders as a plain, explicitly non-navigable name', () => {
        // The actual '.area-hidden' check runs against live cytoscape
        // state in the browser (verified separately via headless Chrome
        // against the real large-cycle-app fixture, since Jest here only
        // renders the static page shell, not a live cy instance) - this
        // confirms the source contains that exact guard and wording, so a
        // hidden member never gets a data-scc-nav-id in the first place.
        const html = buildHtmlTemplate({ nodes: [], edges: [] });

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
        const html = buildHtmlTemplate({ nodes: [malicious, partner], edges: [] });

        expect(html).toContain('function escapeAttribute(value)');
        expect(html).not.toContain('data-scc-nav-id="/repo/"><script>alert(1)</script>.ts"');
        expect(html).not.toContain('<script>alert(1)</script>.ts"');
    });
});

describe('buildHtmlTemplate SCC focus (viewport-only, no new detection)', () => {
    // Focus reuses the same sccId/sccSize/node-id data buildCycleContextHtml
    // already reads (see the describe block above) - it never re-derives SCC
    // membership, never changes graph data, never deletes a node. Like that
    // block, buildCycleContextHtml/focusScc/exitFocus are client-side
    // functions whose SOURCE is embedded once, unconditionally - Jest can't
    // spin up a live cytoscape instance to execute them, so these assert
    // source structure (the right guard/formula/wiring exists) rather than a
    // rendered result for a specific fixture. The actual live behavior (a
    // real click producing a real, larger viewport) is verified separately
    // via headless Chrome against the real large-cycle-app fixture (both its
    // 7-node ring and its 2-node pair).
    const html = buildHtmlTemplate({ nodes: [], edges: [] });

    it('renders a Focus SCC action, gated behind the same real-SCC (2+ members) guard as member navigation', () => {
        // focusButtonHtml is computed inside buildCycleContextHtml, after
        // its early `data.sccSize < 2 || data.sccId === undefined -> return
        // ''` guard - so a node outside any SCC gets '' from the whole
        // function, Focus button included, exactly like the member list
        // above it. Checking the guard precedes the button's own
        // declaration in source order confirms this isn't a second,
        // separately-gated code path.
        expect(html).toContain('data-focus-scc-id="${data.sccId}"');
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
        // number straight through to focusScc, with no remapping.
        expect(html).toContain('const data = node.data();');
        expect(html).toContain('data-focus-scc-id="${data.sccId}"');
        expect(html).toContain('focusScc(Number(focusEl.dataset.focusSccId))');
    });

    it('accounts for every AVAILABLE (non-hidden) member when determining focus scope, for an SCC of any size', () => {
        // visibleMemberCount = the selected node itself + every OTHER
        // member not '.area-hidden' - computed over the FULL otherMembers
        // collection (cy.nodes().filter(sccId match)), not the
        // MAX_SCC_MEMBERS_SHOWN-truncated "shown" list used only for the
        // rendered name list. This one formula is size-agnostic: it must
        // correctly account for all 7 members of large-cycle-app's ring SCC
        // and all 2 members of its pair SCC alike, without a
        // size-specific branch - confirmed here by asserting it reads from
        // `otherMembers` (the untruncated collection), not `shown`.
        expect(html).toContain(
            'const visibleMemberCount = 1 + otherMembers.filter((candidate) => !candidate.hasClass(\'area-hidden\')).length;',
        );
        expect(html).not.toContain('shown.filter((candidate) => !candidate.hasClass(\'area-hidden\'))');
    });

    it('focusScc itself independently re-derives its member set the same way (own sccId match, non-hidden only) rather than trusting the button', () => {
        // Belt-and-suspenders, matching this file's existing convention
        // (navigateToSccMember re-checks '.area-hidden' rather than
        // trusting the HUD's own rendering) - focusScc must filter
        // cy.nodes() by sccId and exclude '.area-hidden' independently,
        // so a stale button (filters changed between render and click)
        // can't focus on a member that isn't actually visible. This is the
        // one formula that must work correctly whether the SCC has 2
        // members or 7 - it isn't given a count, it derives its own set.
        expect(html).toContain('function focusScc(sccId)');
        expect(html).toMatch(
            /candidate\.data\('sccId'\) === sccId && !candidate\.hasClass\('area-hidden'\)/,
        );
        expect(html).toContain('if (members.length < 2) {');
    });

    it('exiting focus ("Show full graph") restores the full graph - never leaves elements faded/hidden by data, only by view', () => {
        // exitFocus() must clear focusedSccId and re-hide the exit button;
        // it deliberately does NOT touch cy.remove()/'.area-hidden' (those
        // belong to the Area/Connections filters, untouched by Focus) - so
        // "the full graph" was never actually altered, only its viewport
        // and fade/highlight classes were. Fit Graph independently also
        // calls exitFocus() first, so the two controls can't leave a
        // half-exited state.
        expect(html).toContain('function exitFocus()');
        expect(html).toContain('focusedSccId = null;');
        expect(html).toContain("showFullGraphButton.hidden = true;");
        expect(html).toContain("showFullGraphButton?.addEventListener('click', () => {\n                exitFocus();");
        const fitBtnStart = html.indexOf("fitButton.addEventListener(");
        const fitBtnEnd = html.indexOf("fitCyAvoidingChrome(cy, 40);", fitBtnStart);
        expect(fitBtnStart).toBeGreaterThan(-1);
        expect(html.slice(fitBtnStart, fitBtnEnd)).toContain('exitFocus();');
        expect(html).toContain('exitFocus();\n\n                const isCleanLayout');
    });

    it('never touches Area/Connections filter state - no new class, no visibility change, no new filter option', () => {
        // Focus's own fade/highlight is scoped to the pre-existing
        // '.faded'/'.highlighted'/'.highlighted-edge' classes already used
        // by highlightNeighborhood (same visual language, no new CSS
        // concept). It reads '.area-hidden' (to exclude currently-hidden
        // members from its own member set - see the two tests above) but
        // must never WRITE it - never add/remove that exact class, nor
        // call cy.add()/cy.remove() itself, either of which would change
        // what the Area/Connections filters themselves consider visible.
        const focusFnStart = html.indexOf('function focusScc(sccId)');
        const focusFnEnd = html.indexOf('function exitFocus()');
        const focusFnSource = html.slice(focusFnStart, focusFnEnd);

        expect(focusFnSource).not.toContain("addClass('area-hidden')");
        expect(focusFnSource).not.toContain("removeClass('area-hidden')");
        expect(focusFnSource).not.toContain('cy.add(');
        expect(focusFnSource).not.toContain('cy.remove(');
        expect(focusFnSource).toContain("cy.elements().addClass('faded');");
        expect(focusFnSource).toContain("members.addClass('highlighted');");
    });

    it('a member hidden by the current filter can never make Focus claim the whole SCC is shown', () => {
        // focusScc's own member query excludes '.area-hidden' candidates
        // (same assertion as the independent-re-derivation test above,
        // re-stated against the specific "false full-SCC claim" risk) - and
        // the button's own label already says "N of M modules visible"
        // whenever a filter has hidden part of the SCC (visibleMemberCount
        // < data.sccSize), rather than presenting a plain "(M modules)"
        // count that would read as "the whole thing is on screen".
        expect(html).toContain('visibleMemberCount < data.sccSize');
        expect(html).toContain('Focus SCC (${visibleMemberCount} of ${data.sccSize} modules visible)');
        expect(html).toContain('Focus SCC (${data.sccSize} modules)');
    });

    it('the global SCC summary stays a whole-graph count, unaffected by Focus - never becomes a focused-subset summary', () => {
        // computeSccSummary(cy) (see the "global SCC summary" describe
        // block above) reads cy.nodes() - the WHOLE graph's data - and is
        // computed once, independent of any focusedSccId state. Focus adds
        // no code path that re-runs or narrows it: this re-confirms (in
        // this new describe block, since it's the exact property Focus
        // must not break) that computeSccSummary's own source has no
        // reference to focusedSccId/focusScc.
        const summaryFnStart = html.indexOf('function computeSccSummary(cy)');
        const summaryFnEnd = html.indexOf('function ', summaryFnStart + 1);
        const summaryFnSource = html.slice(summaryFnStart, summaryFnEnd);

        expect(summaryFnSource).not.toContain('focusedSccId');
        expect(summaryFnSource).not.toContain('focusScc');
        expect(html).toContain('entire analyzed graph, not the current filtered view');
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
    const html = buildHtmlTemplate({ nodes: [], edges: [] });

    it('finds one 2-node cycle (A -> B -> A) via a bounded BFS back to the start, not full enumeration', () => {
        // The algorithm: step to the selected node's own first (sorted,
        // so deterministic) outgoing neighbor within its SCC, then run a
        // plain BFS - visiting each member at most once - back to the
        // start. This is what a 2-node SCC's own cycle (left.ts <->
        // right.ts) reduces to: one step out, one BFS step back. Real
        // output confirmed via headless Chrome.
        expect(html).toContain('function findCycleThroughNode(sccId, startId)');
        expect(html).toContain("candidate.data('sccId') === sccId");
        expect(html).toContain('const firstStep = startTargets[0];');
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
        expect(html).toContain('const firstStep = startTargets[0];');
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
        expect(html).toMatch(/function buildCycleListHtml\(memberNodes\) \{\s*return memberNodes\s*\.map/);
        expect(html).not.toMatch(/function buildCycleListHtml[\s\S]{0,400}\.slice\(/);
    });

    it('a member hidden by the current filter is marked, never silently claimed visible', () => {
        // Same '.area-hidden' convention as the SCC member list and Focus
        // above - a hidden member renders as plain, non-navigable text
        // (no data-cycle-nav-id), and whenever at least one member is
        // hidden, an explicit note states exactly how many of the cycle's
        // modules are affected, rather than presenting the ordered list as
        // if the whole cycle were on screen.
        expect(html).toContain("node.hasClass('area-hidden')");
        expect(html).toContain('cycle-detail-item-hidden');
        expect(html).toContain('hidden by the current filter');
        expect(html).toContain('hiddenCount > 0');
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
        const bodyListenerSource = html.slice(bodyListenerStart, bodyListenerStart + 400);
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
        expect(html).toContain('id="cycle-detail-count-badge"');
        expect(html).toContain('cycleDetailCountBadge.textContent = `${memberNodes.length} module${memberNodes.length === 1 ? \'\' : \'s\'}`;');
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
        expect(html).toContain("<span class=\"cycle-arrow\">&#8618;</span> back to <span class=\"cycle-chip cycle-node-start\">");
        expect(html).toContain("const startCls = index === 0 ? ' cycle-detail-item-start' : '';");
    });

    it('the flow diagram lays cells into fixed-size rows and alternates reading direction row to row (a snake/boustrophedon layout)', () => {
        expect(html).toContain('const CYCLE_FLOW_ROW_SIZE = 4;');
        expect(html).toContain('const isReverse = rowIndex % 2 === 1;');
        expect(html).toMatch(/isReverse\s*\?\s*\[\.\.\.rowCells\]\.reverse\(\)\s*:\s*rowCells/);
    });

    it('the closing indicator is a distinct, explicit line - not one more chip silently appended to the last row', () => {
        expect(html).toContain('function buildCycleFlowHtml(memberNodes, startLabel)');
        expect(html).toContain('class="cycle-flow-closing"');
    });

    it('the hidden-filter note uses a calm, non-alarming info style, matching the same blue used for the start/count accents', () => {
        // Wording changed (the old note re-stated the full "This cycle
        // contains N modules" total, now already shown by the header
        // badge/metadata chips) but the guarantee - a filtered-out member
        // is disclosed, never silently dropped from the count - did not.
        expect(html).toContain('hidden by the current filter');
        expect(html).toContain('hiddenCount > 0');
        expect(html).not.toContain('This cycle contains ${memberNodes.length} modules;');
    });
});
