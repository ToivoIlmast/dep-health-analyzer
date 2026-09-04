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
                },
            },
        ];
        const edges: CytoscapeEdge[] = [];

        const html = buildHtmlTemplate({ nodes, edges });

        expect(html).not.toContain('</script><script>alert(1)</script>');
    });

    it('still embeds the real node data, just safely encoded', () => {
        const nodes: CytoscapeNode[] = [{ data: { id: 'src/a.ts', label: 'a.ts' } }];
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
