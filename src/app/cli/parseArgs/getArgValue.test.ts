import { getArgValue } from './getArgValue';

describe('getArgValue (F16)', () => {
    it('returns the following token as the value for a normal flag/value pair', () => {
        expect(getArgValue(['--target', './src'], '--target')).toBe('./src');
    });

    it('returns undefined when the flag is not present at all', () => {
        expect(getArgValue(['--mode', 'html'], '--target')).toBeUndefined();
    });

    it('does not let a value from an unrelated, later flag/value pair leak into an earlier flag lookup', () => {
        // Sanity check for the normal multi-flag case, not a regression by
        // itself: getArgValue only ever looks at the token immediately
        // after ITS OWN flag.
        expect(getArgValue(['--target', './src', '--mode', 'html'], '--target')).toBe('./src');
        expect(getArgValue(['--target', './src', '--mode', 'html'], '--mode')).toBe('html');
    });

    // F16 (AUDIT_v0.11.0.md / task): `--target --mode html` must not read
    // "--mode" as --target's value - the token right after a flag can
    // itself be another flag when the first flag's value was simply
    // omitted.
    describe('a long-option-shaped token right after the flag (F16)', () => {
        it('returns undefined instead of the next long option', () => {
            expect(getArgValue(['--target', '--mode', 'html'], '--target')).toBeUndefined();
        });

        it('does not swallow the next flag - it stays parseable by its own lookup', () => {
            const args = ['--target', '--mode', 'html'];

            expect(getArgValue(args, '--target')).toBeUndefined();
            expect(getArgValue(args, '--mode')).toBe('html');
        });
    });

    describe('a short-option-shaped token right after the flag (F16)', () => {
        it('returns undefined instead of treating an unknown short option as the value', () => {
            expect(getArgValue(['--target', '-x'], '--target')).toBeUndefined();
        });
    });

    describe('the flag is the very last token (F16)', () => {
        it('returns undefined instead of undefined-from-out-of-bounds masquerading as a real value', () => {
            // Same observable result (undefined) as today for THIS specific
            // case - out-of-bounds array access already yields undefined.
            // Locked explicitly so this case can never regress silently
            // while the "looks like another flag" case above is fixed.
            expect(getArgValue(['--target'], '--target')).toBeUndefined();
        });
    });

    describe('legitimate values are preserved (F16, no over-fix)', () => {
        // mode/strategy are fixed enum strings and baseline is a git ref
        // (git's own check-ref-format forbids a ref starting with "-"), so
        // none of those ever legitimately start with "-". `--option=value`
        // syntax isn't parsed by this function at all (it only ever
        // matches an exact `flag` token, never a `flag=value` combined
        // token), so there's no existing "=" contract to preserve either.
        // These are the ordinary flag/value pairs already used throughout
        // the CLI.
        it.each([
            ['./src', ['--target', './src']],
            ['html', ['--mode', 'html']],
            ['HEAD~1', ['--baseline', 'HEAD~1']],
            ['25', ['--points', '25']],
            ['incremental', ['--strategy', 'incremental']],
        ])('keeps returning "%s" for a normal value', (expected, args) => {
            expect(getArgValue(args, args[0]!)).toBe(expected);
        });

        // `--points` is the one exception: it's a signed number, so a
        // NEGATIVE-looking token right after it is a real (if invalid)
        // attempted value, not another option - it must still reach
        // parsePoints.ts's own validation as the literal string "-5" so
        // that rejects it with "Invalid --points \"-5\"", rather than
        // getArgValue silently treating it as "no value" and parsePoints
        // falling back to its default as if --points had never been typed
        // at all. A real regression caught while implementing this fix:
        // the first version used a blanket `startsWith('-')` check and
        // broke parsePoints.test.ts's existing "rejects a negative number"
        // case exactly this way.
        it('still returns a negative-number-shaped token as the value, not undefined', () => {
            expect(getArgValue(['--points', '-5'], '--points')).toBe('-5');
        });
    });
});
