// Deliberately NOT a general i18n refactor of this report - scoped
// exactly to the new Findings-first UI (header/tabs/language switcher,
// the Findings view's own text) plus the pre-existing Findings-overview
// strings it visually replaces. The Graph itself (toolbar, HUD, minimap,
// the educational and concrete-cycle modals) keeps its existing English
// text unchanged - none of that is "directly affected" by this task's
// information-architecture change, and localizing it would be exactly
// the "big i18n refactor" this task explicitly says not to do.
//
// Production language support is exactly three languages - English
// (default), Finnish, Swedish - per explicit product requirement. This
// whole dictionary is embedded into the generated report's inline
// <script> (see safeJsonForScript(I18N) in template.ts) so the language
// switcher works fully offline, with no network/CDN/translation-service
// dependency - the standalone-HTML requirement applies to this exactly
// as much as to everything else in the report.
export const SUPPORTED_LANGUAGES = ['en', 'fi', 'sv'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export interface Dictionary {
    appTitle: string;
    languageLabel: string;
    tabFindings: string;
    tabGraph: string;
    findingsTitle: string;
    findingsCyclesHeading: string;
    findingsZeroState: string;
    exploreGraphZero: string;
    exploreFullGraph: string;
    viewCycleButton: string;
    // Plain %n placeholders, substituted client- and server-side by the
    // same small formatText() helper (see template.ts) - not a real
    // pluralization/ICU engine, which would be over-engineering for a
    // handful of short technical sentences. Kept deliberately simple:
    // moduleCount is realistically almost never exactly 1 for a project
    // with a detected cycle (a cycle needs 2+ modules), so unlike the
    // top-level module/dependency scale line (which DOES special-case
    // singular English text below), these two only need one phrasing
    // each per language.
    scaleModules: string; // '%n module' / '%n modules' chosen by caller
    scaleModulesSingular: string;
    scaleDependencies: string;
    scaleDependenciesSingular: string;
    findingsCaveatSingular: string; // '1 SCC containing cycles - ...'
    findingsCaveatPlural: string; // '%n SCCs containing cycles - ...'
    sccLabel: string; // 'SCC #%id &middot; %n modules'
}

export const I18N: Record<LanguageCode, Dictionary> = {
    en: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Language',
        tabFindings: 'Findings',
        tabGraph: 'Graph',
        findingsTitle: 'Dependency health',
        findingsCyclesHeading: 'Dependency cycles',
        findingsZeroState: 'No dependency cycles detected.',
        exploreGraphZero: 'Explore graph',
        exploreFullGraph: 'Explore full graph',
        viewCycleButton: 'View cycle',
        scaleModules: '%n modules',
        scaleModulesSingular: '%n module',
        scaleDependencies: '%n dependencies',
        scaleDependenciesSingular: '%n dependency',
        findingsCaveatSingular:
            '1 SCC containing cycles - each row shows one representative cycle; an SCC may contain others.',
        findingsCaveatPlural:
            '%n SCCs containing cycles - each row shows one representative cycle; an SCC may contain others.',
        sccLabel: 'SCC #%id &middot; %n modules',
    },
    // Straightforward technical translations for a small utility tool's
    // UI - not professionally reviewed by a native speaker. Kept simple
    // deliberately (matches the English source's own plain, short
    // sentences) rather than attempting exact grammatical number
    // agreement for every count, a common simplification in real
    // software localization for exactly this kind of short technical
    // string.
    fi: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Kieli',
        tabFindings: 'Havainnot',
        tabGraph: 'Kaavio',
        findingsTitle: 'Riippuvuuksien tila',
        findingsCyclesHeading: 'Riippuvuussyklit',
        findingsZeroState: 'Riippuvuussyklejä ei havaittu.',
        exploreGraphZero: 'Tutki kaaviota',
        exploreFullGraph: 'Tutki koko kaaviota',
        viewCycleButton: 'Näytä sykli',
        scaleModules: '%n moduulia',
        scaleModulesSingular: '%n moduuli',
        scaleDependencies: '%n riippuvuutta',
        scaleDependenciesSingular: '%n riippuvuus',
        findingsCaveatSingular:
            '1 SCC sisältää syklejä - kukin rivi näyttää yhden esimerkkisyklin; SCC voi sisältää muitakin.',
        findingsCaveatPlural:
            '%n SCC:tä sisältää syklejä - kukin rivi näyttää yhden esimerkkisyklin; SCC voi sisältää muitakin.',
        sccLabel: 'SCC #%id &middot; %n moduulia',
    },
    sv: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Språk',
        tabFindings: 'Resultat',
        tabGraph: 'Graf',
        findingsTitle: 'Beroendehälsa',
        findingsCyclesHeading: 'Beroendecykler',
        findingsZeroState: 'Inga beroendecykler upptäcktes.',
        exploreGraphZero: 'Utforska grafen',
        exploreFullGraph: 'Utforska hela grafen',
        viewCycleButton: 'Visa cykel',
        scaleModules: '%n moduler',
        scaleModulesSingular: '%n modul',
        scaleDependencies: '%n beroenden',
        scaleDependenciesSingular: '%n beroende',
        findingsCaveatSingular:
            '1 SCC innehåller cykler - varje rad visar en exempelcykel; en SCC kan innehålla fler.',
        findingsCaveatPlural:
            '%n SCC:er innehåller cykler - varje rad visar en exempelcykel; en SCC kan innehålla fler.',
        sccLabel: 'SCC #%id &middot; %n moduler',
    },
};

// Plain %token substitution - not a real ICU/pluralization engine, which
// would be over-engineering for a handful of short technical sentences
// each language's dictionary already phrases as a single fixed template
// (see the Dictionary comments above). Used identically server-side
// (this function) and client-side (a small mirrored copy in the
// generated report's own inline script, since browser code can't import
// this module - the same split already established for escapeHtml).
export function formatI18n(template: string, vars: Record<string, string | number>): string {
    return template.replace(/%(\w+)/g, (match, key: string) =>
        key in vars ? String(vars[key]) : match
    );
}
