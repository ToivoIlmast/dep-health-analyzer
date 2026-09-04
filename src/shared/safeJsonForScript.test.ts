import { safeJsonForScript } from './safeJsonForScript';

const BACKSLASH = String.fromCharCode(92);

describe('safeJsonForScript', () => {
    it('does not contain a raw < character even when the input has a closing script tag', () => {
        const output = safeJsonForScript({ title: '</script><script>alert(1)</script>' });

        expect(output.includes('<')).toBe(false);
    });

    it('replaces < with its six-character unicode escape sequence', () => {
        const output = safeJsonForScript({ title: '<x>' });

        expect(output).toContain(BACKSLASH + 'u003c');
    });

    it('round-trips back to the original value when evaluated as JS (simulating a browser parsing the generated script)', () => {
        const original = { title: '</script><script>alert(1)</script>', count: 3 };
        const output = safeJsonForScript(original);

        const roundTripped = eval(`(${output})`);
        expect(roundTripped).toEqual(original);
    });

    it('leaves values with no < unchanged in content', () => {
        const output = safeJsonForScript({ a: 1, b: 'plain text' });

        expect(output).toBe('{"a":1,"b":"plain text"}');
    });

    it('handles arrays of objects', () => {
        const output = safeJsonForScript([{ id: '<a>' }, { id: '<b>' }]);

        expect(output.includes('<')).toBe(false);
        expect(output.match(new RegExp(BACKSLASH + BACKSLASH + 'u003c', 'g'))?.length).toBe(2);
    });
});
