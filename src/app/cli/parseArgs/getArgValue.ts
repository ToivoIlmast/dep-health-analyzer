/**
 * A token that starts with "-" is only treated as another option (not a
 * value) when it isn't ALSO parseable as a number - `--points -5` must
 * still reach parsePoints.ts as the string "-5" so its own validation can
 * reject it with a proper "Invalid --points" message, not have
 * getArgValue silently swallow it first and fall back to the default as
 * if nothing were typed at all. `--mode`/`-x`/etc. are not numbers, so
 * they're unaffected. No option in this CLI has any OTHER kind of
 * legitimate value starting with "-" (enum strings, and git refs - which
 * git's own ref-format forbids from starting with "-").
 */
function looksLikeAnotherOption(token: string): boolean {
    return token.startsWith('-') && Number.isNaN(Number(token));
}

/**
 * F16: the token right after a flag is only a real value if it doesn't
 * itself look like another option - otherwise the flag's own value was
 * simply omitted (e.g. `--target --mode html` or a trailing `--target`
 * with nothing after it), and treating that next token as the value
 * would silently feed it into the wrong option.
 */
export function getArgValue(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);

    if (index === -1) {
        return undefined;
    }

    const value = args[index + 1];

    if (value === undefined || looksLikeAnotherOption(value)) {
        return undefined;
    }

    return value;
}
