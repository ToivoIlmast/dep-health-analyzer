import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
    it('escapes angle brackets so a script tag cannot be injected', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe(
            '&lt;script&gt;alert(1)&lt;/script&gt;'
        );
    });

    it('escapes an inline event handler attribute payload', () => {
        expect(escapeHtml('<img src=x onerror=alert(2)>')).toBe(
            '&lt;img src=x onerror=alert(2)&gt;'
        );
    });

    it('escapes ampersands', () => {
        expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes double and single quotes', () => {
        expect(escapeHtml(`"double" 'single'`)).toBe('&quot;double&quot; &#39;single&#39;');
    });

    it('leaves plain text unchanged', () => {
        expect(escapeHtml('src/features/regression/analyze.ts')).toBe(
            'src/features/regression/analyze.ts'
        );
    });

    it('escapes every special character in a mixed string exactly once', () => {
        expect(escapeHtml('a<b>&c"d\'e')).toBe('a&lt;b&gt;&amp;c&quot;d&#39;e');
    });

    it('handles an empty string', () => {
        expect(escapeHtml('')).toBe('');
    });
});
