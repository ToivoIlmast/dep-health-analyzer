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
