import { I18N, SUPPORTED_LANGUAGES, formatI18n } from './i18n';

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
    it('supports exactly English, Finnish, and Swedish - the explicit production language requirement, no more, no fewer', () => {
        expect(SUPPORTED_LANGUAGES).toEqual(['en', 'fi', 'sv']);
        expect(Object.keys(I18N).sort()).toEqual(['en', 'fi', 'sv']);
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
                expect(value).not.toMatch(/TODO|FIXME/i);
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

    it('the singular/plural scale templates are genuinely different strings per language, not the same text reused for both', () => {
        for (const lang of SUPPORTED_LANGUAGES) {
            expect(I18N[lang].scaleModules).not.toBe(I18N[lang].scaleModulesSingular);
            expect(I18N[lang].scaleDependencies).not.toBe(I18N[lang].scaleDependenciesSingular);
        }
    });
});
