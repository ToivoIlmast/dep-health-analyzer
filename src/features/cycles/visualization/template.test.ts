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
