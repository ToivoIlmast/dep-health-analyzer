// Deliberately NOT a general i18n refactor of this report - scoped
// exactly to the new Findings-first UI (header/tabs/language switcher,
// the Findings view's own text) plus the pre-existing Findings-overview
// strings it visually replaces. The Graph itself (toolbar, HUD, minimap,
// the educational and concrete-cycle modals) keeps its existing English
// text unchanged - none of that is "directly affected" by this task's
// information-architecture change, and localizing it would be exactly
// the "big i18n refactor" this task explicitly says not to do.
//
// Production language support is exactly fourteen languages - English
// (default), Finnish, Swedish, Norwegian, Danish, Icelandic, German,
// French, Spanish, Polish, Portuguese, Russian, Arabic, Japanese - per
// explicit product requirement. This whole dictionary is embedded into
// the generated report's inline <script> (see safeJsonForScript(I18N) in
// template.ts) so the language switcher works fully offline, with no
// network/CDN/translation-service dependency - the standalone-HTML
// requirement applies to this exactly as much as to everything else in
// the report.
export const SUPPORTED_LANGUAGES = [
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
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

// Exactly one of the fourteen (Arabic) reads right-to-left. Scoped
// narrowly on purpose: only the localized surfaces (#app-header,
// .findings-lang-block) ever get a dir="rtl" attribute (see
// renderFindingsOverview below and applyLanguage() in template.ts) - the
// Graph itself (toolbar, HUD, minimap, both modals, and critically the
// dependency graph's own edges/arrows) is never flipped. A→B keeps
// meaning "A depends on B" regardless of interface reading direction;
// only this task's own localized text/layout mirrors for Arabic.
export const RTL_LANGUAGES: ReadonlySet<LanguageCode> = new Set(['ar']);

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
    // each per language. Most languages below use one fixed plural form
    // regardless of the exact count (a common, deliberate simplification
    // for short technical UI strings - real grammatical number agreement,
    // e.g. Polish/Russian's count-dependent plural classes or Arabic's
    // dual/plural system, would need a real pluralization engine, which
    // this task explicitly says not to add). Japanese nouns don't
    // inflect for number at all, so its singular/plural pair is
    // legitimately identical text, not an oversight.
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
    no: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Språk',
        tabFindings: 'Funn',
        tabGraph: 'Graf',
        findingsTitle: 'Avhengighetshelse',
        findingsCyclesHeading: 'Avhengighetssykluser',
        findingsZeroState: 'Ingen avhengighetssykluser oppdaget.',
        exploreGraphZero: 'Utforsk grafen',
        exploreFullGraph: 'Utforsk hele grafen',
        viewCycleButton: 'Vis syklus',
        scaleModules: '%n moduler',
        scaleModulesSingular: '%n modul',
        scaleDependencies: '%n avhengigheter',
        scaleDependenciesSingular: '%n avhengighet',
        findingsCaveatSingular:
            '1 SCC inneholder sykluser - hver rad viser én eksempelsyklus; en SCC kan inneholde flere.',
        findingsCaveatPlural:
            '%n SCC-er inneholder sykluser - hver rad viser én eksempelsyklus; en SCC kan inneholde flere.',
        sccLabel: 'SCC #%id &middot; %n moduler',
    },
    da: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Sprog',
        tabFindings: 'Resultater',
        tabGraph: 'Graf',
        findingsTitle: 'Afhængighedssundhed',
        findingsCyclesHeading: 'Afhængighedscyklusser',
        findingsZeroState: 'Ingen afhængighedscyklusser fundet.',
        exploreGraphZero: 'Udforsk grafen',
        exploreFullGraph: 'Udforsk hele grafen',
        viewCycleButton: 'Vis cyklus',
        scaleModules: '%n moduler',
        scaleModulesSingular: '%n modul',
        scaleDependencies: '%n afhængigheder',
        scaleDependenciesSingular: '%n afhængighed',
        findingsCaveatSingular:
            '1 SCC indeholder cyklusser - hver række viser én eksempelcyklus; en SCC kan indeholde flere.',
        findingsCaveatPlural:
            "%n SCC'er indeholder cyklusser - hver række viser én eksempelcyklus; en SCC kan indeholde flere.",
        sccLabel: 'SCC #%id &middot; %n moduler',
    },
    // Icelandic in particular is a hard language to render correctly
    // without a native reviewer (rich noun-case system) - this is a
    // best-effort, non-native approximation more than most of the
    // others, kept deliberately in the same plain register as the
    // English source rather than attempting to sound polished.
    is: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Tungumál',
        tabFindings: 'Niðurstöður',
        tabGraph: 'Graf',
        findingsTitle: 'Staða ósjálfstæða',
        findingsCyclesHeading: 'Hringrásir ósjálfstæða',
        findingsZeroState: 'Engar hringrásir ósjálfstæða fundust.',
        exploreGraphZero: 'Skoða graf',
        exploreFullGraph: 'Skoða allt grafið',
        viewCycleButton: 'Skoða hringrás',
        scaleModules: '%n einingar',
        scaleModulesSingular: '%n eining',
        // "ósjálfstæði" (dependency/dependencies) is used invariantly
        // here in its common technical sense, unlike "eining"/"einingar"
        // above - a narrower, single-word exception, not a claim that
        // Icelandic lacks grammatical number generally (see i18n.test.ts).
        scaleDependencies: '%n ósjálfstæði',
        scaleDependenciesSingular: '%n ósjálfstæði',
        findingsCaveatSingular:
            '1 SCC inniheldur hringrásir - hver lína sýnir eina dæmahringrás; SCC getur innihaldið fleiri.',
        findingsCaveatPlural:
            '%n SCC innihalda hringrásir - hver lína sýnir eina dæmahringrás; SCC getur innihaldið fleiri.',
        sccLabel: 'SCC #%id &middot; %n einingar',
    },
    de: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Sprache',
        tabFindings: 'Befunde',
        tabGraph: 'Graph',
        findingsTitle: 'Abhängigkeitszustand',
        findingsCyclesHeading: 'Abhängigkeitszyklen',
        findingsZeroState: 'Keine Abhängigkeitszyklen erkannt.',
        exploreGraphZero: 'Graph erkunden',
        exploreFullGraph: 'Gesamten Graph erkunden',
        viewCycleButton: 'Zyklus anzeigen',
        scaleModules: '%n Module',
        scaleModulesSingular: '%n Modul',
        scaleDependencies: '%n Abhängigkeiten',
        scaleDependenciesSingular: '%n Abhängigkeit',
        findingsCaveatSingular:
            '1 SCC enthält Zyklen - jede Zeile zeigt einen Beispielzyklus; eine SCC kann weitere enthalten.',
        findingsCaveatPlural:
            '%n SCCs enthalten Zyklen - jede Zeile zeigt einen Beispielzyklus; eine SCC kann weitere enthalten.',
        sccLabel: 'SCC #%id &middot; %n Module',
    },
    fr: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Langue',
        tabFindings: 'Résultats',
        tabGraph: 'Graphe',
        findingsTitle: 'État des dépendances',
        findingsCyclesHeading: 'Cycles de dépendances',
        findingsZeroState: 'Aucun cycle de dépendances détecté.',
        exploreGraphZero: 'Explorer le graphe',
        exploreFullGraph: 'Explorer le graphe complet',
        viewCycleButton: 'Voir le cycle',
        scaleModules: '%n modules',
        scaleModulesSingular: '%n module',
        scaleDependencies: '%n dépendances',
        scaleDependenciesSingular: '%n dépendance',
        findingsCaveatSingular:
            "1 SCC contient des cycles - chaque ligne montre un cycle représentatif ; un SCC peut en contenir d'autres.",
        findingsCaveatPlural:
            "%n SCC contiennent des cycles - chaque ligne montre un cycle représentatif ; un SCC peut en contenir d'autres.",
        sccLabel: 'SCC n&deg;%id &middot; %n modules',
    },
    es: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Idioma',
        tabFindings: 'Resultados',
        tabGraph: 'Grafo',
        findingsTitle: 'Estado de las dependencias',
        findingsCyclesHeading: 'Ciclos de dependencias',
        findingsZeroState: 'No se detectaron ciclos de dependencias.',
        exploreGraphZero: 'Explorar grafo',
        exploreFullGraph: 'Explorar grafo completo',
        viewCycleButton: 'Ver ciclo',
        scaleModules: '%n módulos',
        scaleModulesSingular: '%n módulo',
        scaleDependencies: '%n dependencias',
        scaleDependenciesSingular: '%n dependencia',
        findingsCaveatSingular:
            '1 SCC contiene ciclos - cada fila muestra un ciclo representativo; un SCC puede contener otros.',
        findingsCaveatPlural:
            '%n SCC contienen ciclos - cada fila muestra un ciclo representativo; un SCC puede contener otros.',
        sccLabel: 'SCC n.&ordm;%id &middot; %n módulos',
    },
    // Uses one fixed plural form regardless of exact count (the same
    // simplification noted on the Dictionary type above) rather than
    // Polish's real few/many grammatical plural classes, which would
    // need a real pluralization engine.
    pl: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Język',
        tabFindings: 'Wyniki',
        tabGraph: 'Graf',
        findingsTitle: 'Stan zależności',
        findingsCyclesHeading: 'Cykle zależności',
        findingsZeroState: 'Nie wykryto cykli zależności.',
        exploreGraphZero: 'Przeglądaj graf',
        exploreFullGraph: 'Przeglądaj cały graf',
        viewCycleButton: 'Pokaż cykl',
        scaleModules: '%n modułów',
        scaleModulesSingular: '%n moduł',
        scaleDependencies: '%n zależności',
        scaleDependenciesSingular: '%n zależność',
        findingsCaveatSingular:
            '1 SCC zawiera cykle - każdy wiersz pokazuje jeden przykładowy cykl; SCC może zawierać więcej.',
        findingsCaveatPlural:
            '%n SCC zawiera cykle - każdy wiersz pokazuje jeden przykładowy cykl; SCC może zawierać więcej.',
        sccLabel: 'SCC #%id &middot; %n modułów',
    },
    pt: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Idioma',
        tabFindings: 'Resultados',
        tabGraph: 'Grafo',
        findingsTitle: 'Estado das dependências',
        findingsCyclesHeading: 'Ciclos de dependências',
        findingsZeroState: 'Nenhum ciclo de dependências detectado.',
        exploreGraphZero: 'Explorar grafo',
        exploreFullGraph: 'Explorar grafo completo',
        viewCycleButton: 'Ver ciclo',
        scaleModules: '%n módulos',
        scaleModulesSingular: '%n módulo',
        scaleDependencies: '%n dependências',
        scaleDependenciesSingular: '%n dependência',
        findingsCaveatSingular:
            '1 SCC contém ciclos - cada linha mostra um ciclo representativo; um SCC pode conter outros.',
        findingsCaveatPlural:
            '%n SCCs contêm ciclos - cada linha mostra um ciclo representativo; um SCC pode conter outros.',
        sccLabel: 'SCC n&ordm;%id &middot; %n módulos',
    },
    // Uses one fixed plural form regardless of exact count (the same
    // simplification noted on the Dictionary type above) rather than
    // Russian's real count-dependent plural classes (1/2-4/5+), which
    // would need a real pluralization engine.
    ru: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'Язык',
        tabFindings: 'Находки',
        tabGraph: 'Граф',
        findingsTitle: 'Состояние зависимостей',
        findingsCyclesHeading: 'Циклы зависимостей',
        findingsZeroState: 'Циклы зависимостей не обнаружены.',
        exploreGraphZero: 'Открыть граф',
        exploreFullGraph: 'Открыть весь граф',
        viewCycleButton: 'Показать цикл',
        scaleModules: '%n модулей',
        scaleModulesSingular: '%n модуль',
        scaleDependencies: '%n зависимостей',
        scaleDependenciesSingular: '%n зависимость',
        findingsCaveatSingular:
            '1 SCC содержит циклы - каждая строка показывает один пример цикла; SCC может содержать другие.',
        findingsCaveatPlural:
            '%n SCC содержат циклы - каждая строка показывает один пример цикла; SCC может содержать другие.',
        sccLabel: 'SCC &#8470;%id &middot; %n модулей',
    },
    // Right-to-left (see RTL_LANGUAGES above). Arabic's own real
    // singular/dual/plural noun-count agreement is not attempted here -
    // one fixed plural-ish form is used for both scaleModules and
    // scaleModulesSingular's counterparts, the same simplification
    // already applied to Polish/Russian above, rather than adding a real
    // pluralization engine for a handful of short technical sentences.
    // "SCC" and "#%id" are kept in Latin script/digits, matching this
    // project's own established convention (every other language keeps
    // "SCC" untranslated too) - a technical identifier, not prose.
    ar: {
        appTitle: 'dep-health-analyzer',
        languageLabel: 'اللغة',
        tabFindings: 'النتائج',
        tabGraph: 'الرسم البياني',
        findingsTitle: 'سلامة التبعيات',
        findingsCyclesHeading: 'دورات التبعيات',
        findingsZeroState: 'لم يتم اكتشاف أي دورات تبعية.',
        exploreGraphZero: 'استكشاف الرسم البياني',
        exploreFullGraph: 'استكشاف الرسم البياني الكامل',
        viewCycleButton: 'عرض الدورة',
        scaleModules: '%n وحدات',
        scaleModulesSingular: '%n وحدة',
        scaleDependencies: '%n تبعيات',
        scaleDependenciesSingular: '%n تبعية',
        findingsCaveatSingular:
            'يحتوي 1 SCC على دورات - يعرض كل صف دورة تمثيلية واحدة؛ قد يحتوي SCC على دورات أخرى.',
        findingsCaveatPlural:
            'يحتوي %n من مكوّنات SCC على دورات - يعرض كل صف دورة تمثيلية واحدة؛ قد يحتوي SCC على دورات أخرى.',
        sccLabel: 'SCC #%id &middot; %n وحدة',
    },
    // Japanese nouns don't inflect for grammatical number at all -
    // scaleModules/scaleModulesSingular (and the dependency-count pair)
    // are legitimately identical text below, not an oversight; see the
    // Dictionary type's own comment above.
    ja: {
        appTitle: 'dep-health-analyzer',
        languageLabel: '言語',
        tabFindings: '検出結果',
        tabGraph: 'グラフ',
        findingsTitle: '依存関係の健全性',
        findingsCyclesHeading: '依存関係の循環',
        findingsZeroState: '依存関係の循環は検出されませんでした。',
        exploreGraphZero: 'グラフを表示',
        exploreFullGraph: 'グラフ全体を表示',
        viewCycleButton: '循環を表示',
        scaleModules: '%n モジュール',
        scaleModulesSingular: '%n モジュール',
        scaleDependencies: '%n 件の依存関係',
        scaleDependenciesSingular: '%n 件の依存関係',
        findingsCaveatSingular:
            '循環を含む SCC が1件あります - 各行は代表的な循環を1つ表示します。SCC には他の循環が含まれている場合があります。',
        findingsCaveatPlural:
            '循環を含む SCC が%n件あります - 各行は代表的な循環を1つ表示します。SCC には他の循環が含まれている場合があります。',
        sccLabel: 'SCC #%id &middot; %n モジュール',
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
