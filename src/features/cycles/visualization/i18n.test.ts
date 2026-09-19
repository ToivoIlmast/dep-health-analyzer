import { I18N, RTL_LANGUAGES, SUPPORTED_LANGUAGES, formatI18n } from './i18n';

describe('formatI18n', () => {
    it('substitutes a single %token', () => {
        expect(formatI18n('%n modules', { n: 7 })).toBe('7 modules');
    });

    it('substitutes multiple distinct %tokens', () => {
        expect(formatI18n('SCC #%id · %n modules', { id: 2, n: 7 })).toBe('SCC #2 · 7 modules');
    });

    it('leaves an unrecognized %token untouched rather than throwing', () => {
        expect(formatI18n('%unknown thing', { n: 1 })).toBe('%unknown thing');
    });

    it('accepts string values, not just numbers', () => {
        expect(formatI18n('Hello %name', { name: 'world' })).toBe('Hello world');
    });
});

describe('I18N dictionaries', () => {
    const EXPECTED_LANGUAGES = [
        'en',
        'fi',
        'sv',
        'no',
        'da',
        'is',
        'de',
        'fr',
        'es',
        'pl',
        'pt',
        'ru',
        'ar',
        'ja',
    ];

    it('supports exactly the 14 production languages - the explicit production language requirement, no more, no fewer', () => {
        expect(SUPPORTED_LANGUAGES).toEqual(EXPECTED_LANGUAGES);
        expect(Object.keys(I18N).sort()).toEqual([...EXPECTED_LANGUAGES].sort());
    });

    it('English is the first supported language - the default the report renders visible on load', () => {
        expect(SUPPORTED_LANGUAGES[0]).toBe('en');
    });

    it('every language has every key the English dictionary has - no missing translation silently falls back to undefined', () => {
        const englishKeys = Object.keys(I18N.en).sort();

        for (const lang of SUPPORTED_LANGUAGES) {
            expect(Object.keys(I18N[lang]).sort()).toEqual(englishKeys);
        }
    });

    it('every dictionary value is a non-empty string - no placeholder/TODO left behind', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
            for (const value of Object.values(I18N[lang])) {
                expect(typeof value).toBe('string');
                expect((value as string).length).toBeGreaterThan(0);
                // Case-sensitive: several languages legitimately contain
                // the word "todo" (Spanish "all/every") - a real
                // placeholder marker is always shouted-case.
                expect(value).not.toMatch(/\bTODO\b|\bFIXME\b/);
            }
        }
    });

    it('sccLabel templates use %id and %n - the exact placeholders template.ts\'s formatI18n call site substitutes', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
            expect(I18N[lang].sccLabel).toContain('%id');
            expect(I18N[lang].sccLabel).toContain('%n');
        }
    });

    it('findingsCaveatPlural uses %n - the SCC count template.ts substitutes for 2+ SCCs', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
            expect(I18N[lang].findingsCaveatPlural).toContain('%n');
        }
    });

    it('findingsCaveatSingular never uses %n - it is only ever rendered for exactly 1 SCC, a fixed number', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
            expect(I18N[lang].findingsCaveatSingular).not.toContain('%n');
            expect(I18N[lang].findingsCaveatSingular).toContain('1');
        }
    });

    it('modulesInCyclesSummary (F14) uses %n and is a neutral fact, never framing the modules as "problematic"/"bad"/"dangerous"', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
            expect(I18N[lang].modulesInCyclesSummary).toContain('%n');
        }

        // English is the source-of-truth wording check; the other 13
        // languages are checked structurally above (%n presence) - the
        // same reasoning already applied to focusRepresentativeNote.
        expect(I18N.en.modulesInCyclesSummary).not.toMatch(/problematic|bad|dangerous|should be fixed/i);
    });

    it('focusRepresentativeNote uses %visible and %n - after F25a the Focus core for a large SCC is a partial, counted subset, not a single witness cycle, so the note must be able to say "X of Y"', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
            expect(I18N[lang].focusRepresentativeNote).toContain('%visible');
            expect(I18N[lang].focusRepresentativeNote).toContain('%n');
        }
    });

    it('focusRepresentativeNote no longer frames the truncated Focus core as "a representative cycle" - F25a made the core a coverage-budget subset of the SCC, not a witness cycle, so the wording must not imply any single cycle was chosen as special', () => {
        // English is the source-of-truth string checked verbatim; the other
        // 13 languages are checked structurally above (%visible/%n) since
        // asserting the literal absence of a translated phrase per language
        // would just be re-typing the fix as its own test.
        expect(I18N.en.focusRepresentativeNote).not.toMatch(/representative cycle/i);
        expect(I18N.en.focusRepresentativeNote).not.toMatch(/\bcycle\b/i);
    });

    it('the singular/plural scale templates are genuinely different strings per language, not the same text reused for both', () => {
        // Japanese is a deliberate, linguistically correct exception for
        // BOTH pairs - Japanese nouns don't inflect for grammatical
        // number at all, so its singular/plural pair is legitimately
        // identical text (see the Dictionary type's own comment in
        // i18n.ts), not an untranslated placeholder. Icelandic's
        // "ósjálfstæði" (dependency/dependencies) is a second, narrower
        // exception for the dependencies pair only - it behaves as an
        // invariant noun in this technical sense (its own modules
        // pair, "eining"/"einingar", IS genuinely distinct), not a
        // whole-language trait the way Japanese is.
        const noNumberDistinction = new Set(['ja']);
        const noDependenciesNumberDistinction = new Set(['ja', 'is']);

        for (const lang of SUPPORTED_LANGUAGES) {
            if (!noNumberDistinction.has(lang)) {
                expect(I18N[lang].scaleModules).not.toBe(I18N[lang].scaleModulesSingular);
            }
            if (!noDependenciesNumberDistinction.has(lang)) {
                expect(I18N[lang].scaleDependencies).not.toBe(I18N[lang].scaleDependenciesSingular);
            }
        }
    });

    it('Japanese deliberately reuses identical text for its singular/plural pairs - not accidentally, since it has no grammatical number', () => {
        expect(I18N.ja.scaleModules).toBe(I18N.ja.scaleModulesSingular);
        expect(I18N.ja.scaleDependencies).toBe(I18N.ja.scaleDependenciesSingular);
    });
});

describe('RTL_LANGUAGES', () => {
    it('contains exactly Arabic - the one RTL language among the 14 supported', () => {
        expect([...RTL_LANGUAGES]).toEqual(['ar']);
    });

    it('every RTL language is a real supported language code', () => {
        for (const lang of RTL_LANGUAGES) {
            expect(SUPPORTED_LANGUAGES).toContain(lang);
        }
    });
});
