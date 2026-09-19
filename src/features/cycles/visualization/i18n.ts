// Localization dictionary for the generated cycles.html report.
//
// Scope: every user-facing UI/explanatory string in the report - the
// header/tabs/language switcher and Findings view (added first), and now
// the Graph view too (toolbar, left info panel, bottom HUD help text,
// the per-node selected-module panel, the concrete-cycle modal, and the
// educational "What are dependency cycles?" modal). Project DATA never
// lives here: file paths, module names, area names (derived from the
// scanned project's own directory structure), and the illustrative
// "A -> B -> C -> A" cycle example are never translated - only this
// report's own fixed UI vocabulary is.
//
// regression/history reports (src/features/regression/visualization,
// src/features/regression/history/visualization) are a SEPARATE template
// system with no language switcher and no existing i18n hook at all -
// extending localization there would mean building a first i18n
// integration point for a different feature, not "connecting existing
// strings to an existing mechanism." Left out of this task's scope
// deliberately; flagged as a separate, larger body of future work.
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
// .findings-lang-block, and now #graph-explorer/#bottom-hud/both
// dialogs, since the Graph view's own text is localized too) ever get a
// dir="rtl" attribute (see applyLanguage() in template.ts) - the
// dependency graph itself (cytoscape's own node positions and edge
// arrows) is never flipped, and neither is the minimap. A->B keeps
// meaning "A depends on B" regardless of interface reading direction.
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
    // same small formatI18n() helper - not a real pluralization/ICU
    // engine, which would be over-engineering for a handful of short
    // technical sentences. Most languages below use one fixed plural
    // form regardless of the exact count (a common, deliberate
    // simplification for short technical UI strings - real grammatical
    // number agreement, e.g. Polish/Russian's count-dependent plural
    // classes or Arabic's dual/plural system, would need a real
    // pluralization engine). Japanese nouns don't inflect for number at
    // all, so its singular/plural pair is legitimately identical text.
    scaleModules: string; // '%n module' / '%n modules' chosen by caller
    scaleModulesSingular: string;
    scaleDependencies: string;
    scaleDependenciesSingular: string;
    findingsCaveatSingular: string; // '1 SCC containing cycles - ...'
    findingsCaveatPlural: string; // '%n SCCs containing cycles - ...'
    sccLabel: string; // 'SCC #%id &middot; %n modules'

    // --- Graph toolbar ---------------------------------------------
    layoutLabel: string;
    layoutDagreLR: string;
    layoutDagreTB: string;
    layoutDagreLRClean: string;
    layoutFlowTB: string;
    layoutFlowOrthogonal: string;
    layoutFlowOrthogonalLR: string;
    layoutFlowVertical: string;
    layoutBreadthfirst: string;
    layoutCose: string;
    areaLabel: string;
    areaAllOption: string;
    connectionsLabel: string;
    connectionsInternal: string;
    connectionsExternal: string;
    fitGraphButton: string;
    showFullGraphButton: string;
    zoomOutLabel: string;
    zoomInLabel: string;
    cycleInfoButton: string;
    focusRepresentativeNote: string; // 'Showing %visible of %n modules in this SCC - the full SCC is too large to display at once.'

    // --- Left info panel (#hint) -------------------------------------
    detectedSccsHeading: string;
    detectedSccsCaption: string;
    noDependencySccsDetected: string;
    detectedSccsSummary: string; // 'Detected SCCs: %n &middot; Largest SCC: %largest modules.'
    moduleAreaHeading: string;
    moduleAreaCaption: string;
    highlightConnectedToggle: string;

    // --- Bottom HUD help panel ---------------------------------------
    hudHelpHoverLine: string;
    hudHelpClickLine: string; // contains an inline <strong> around one word
    hudHelpCaExplanation: string; // '&mdash; incoming dependencies<br />How many modules depend on this module.'
    hudHelpCeExplanation: string;
    instabilityLabel: string; // shared: HUD heading AND the inline selected-panel label
    hudHelpInstabilityScale: string; // '0.00 = stable module<br />1.00 = highly unstable module'

    // --- Selected-module panel ----------------------------------------
    sccSizeLabel: string;
    hudSelectedEmptyText: string;

    // --- Per-node SCC context block ------------------------------------
    sccContextPartOf: string; // 'Part of a strongly connected component (SCC #%id) of %n modules.'
    sccContextContainsCycles: string;
    sccContextOtherMembers: string; // 'Other modules in this SCC:'
    hiddenByFilterNote: string; // '(hidden by filter)'
    hiddenByFocusNote: string; // '(hidden by Focus)' - Focus-only hiding, distinct from the Area/Connections filter above
    moreCountSuffix: string; // ', +%n more'
    focusSccButton: string;
    showDependencyCycleButton: string;
    moduleCountParen: string; // '(%n modules)'
    moduleCountVisibleParen: string; // '(%visible of %n modules visible)'

    // --- External-area proxy panel --------------------------------------
    externalAreaLabel: string; // 'External area: %name'
    externalAreaAggregatedView: string; // 'Aggregated view of connections between the selected area and %name.'
    externalAreaConnectionsShown: string; // 'Connections shown: %n'

    // --- Focus overflow proxy (P0-1: bounded 1-hop neighbours) -----------
    focusOverflowProxyLabel: string; // '+%n more' (also this proxy's own on-canvas node label)
    focusOverflowPanelBody: string; // 'Showing %visible of %n modules directly connected to this cycle; %hidden more are grouped here to keep the view readable.'
    focusNeighborsTruncatedNote: string; // 'Showing the %visible most connected of %n direct neighbours - the rest are grouped into a summary node.'

    // --- Concrete dependency cycle modal ---------------------------------
    cycleModalTitle: string;
    cycleModalSubtitle: string; // 'One concrete cycle through %module within SCC #%id.'
    cycleModalNote: string;
    showInGraphButton: string;
    cycleHiddenNoteSingular: string; // '%n module hidden by the current filter.'
    cycleHiddenNotePlural: string; // '%n modules hidden by the current filter.'
    cycleHiddenNoteSingularFocus: string; // '%n module hidden by the current Focus.'
    cycleHiddenNotePluralFocus: string; // '%n modules hidden by the current Focus.'
    cycleFlowBackTo: string; // 'back to'
    cycleModulesHeading: string;
    closeButton: string; // shared by both dialogs

    // --- Educational "What are dependency cycles?" modal ------------------
    eduModalTitle: string;
    eduModalWhatIsCycleHeading: string;
    eduModalWhatIsCycleBody: string;
    eduModalExampleCaption: string;
    eduModalWhatIsSccHeading: string;
    eduModalWhatIsSccBody1: string;
    eduModalWhatIsSccBody2: string;
    eduModalWhyMatterHeading: string;
    eduModalWhyMatterIntro: string;
    eduModalWhyMatterItem1: string;
    eduModalWhyMatterItem2: string;
    eduModalWhyMatterItem3: string;
    eduModalWhyMatterItem4: string;
    eduModalWhatReportsHeading: string;
    eduModalWhatReportsBody: string;
    eduModalEmphasis: string;
    eduModalIntentionalBody: string;
    eduModalHowToInvestigateHeading: string;
    eduModalStep1: string;
    eduModalStep2: string;
    eduModalStep3: string;
    eduModalStep4: string;
    eduModalStep5: string;
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

        layoutLabel: 'Layout:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (straight edges, no overlap)',
        layoutFlowTB: 'Flow / Hierarchical (Top to Bottom)',
        layoutFlowOrthogonal: 'Hierarchical (Orthogonal, Top to Bottom)',
        layoutFlowOrthogonalLR: 'Hierarchical (Orthogonal, Left to Right)',
        layoutFlowVertical: 'Hierarchical (Orthogonal, Vertical Flow)',
        layoutBreadthfirst: 'Breadth First',
        layoutCose: 'Force Directed',
        areaLabel: 'Area:',
        areaAllOption: 'All',
        connectionsLabel: 'Connections:',
        connectionsInternal: 'Internal only',
        connectionsExternal: 'With external connections',
        fitGraphButton: 'Fit Graph',
        showFullGraphButton: 'Show full graph',
        zoomOutLabel: 'Zoom out',
        zoomInLabel: 'Zoom in',
        cycleInfoButton: 'What are dependency cycles?',
        focusRepresentativeNote: 'Showing %visible of %n modules in this SCC - the full SCC is too large to display at once.',

        detectedSccsHeading: 'Detected SCCs',
        detectedSccsCaption: '(entire analyzed graph, not the current filtered view)',
        noDependencySccsDetected: 'No dependency SCCs detected.',
        detectedSccsSummary: 'Detected SCCs: %n &middot; Largest SCC: %largest modules.',
        moduleAreaHeading: 'Module area',
        moduleAreaCaption: '(from project structure)',
        highlightConnectedToggle: 'Highlight connected modules',

        hudHelpHoverLine: 'Hover over a module to see dependency metrics.',
        hudHelpClickLine: 'Click a module <strong>to pin</strong> the tooltip.',
        hudHelpCaExplanation:
            '&mdash; incoming dependencies<br />How many modules depend on this module.',
        hudHelpCeExplanation:
            '&mdash; outgoing dependencies<br />How many modules this module depends on.',
        instabilityLabel: 'Instability',
        hudHelpInstabilityScale: '0.00 = stable module<br />1.00 = highly unstable module',

        sccSizeLabel: 'SCC size',
        hudSelectedEmptyText: 'Click a module to see details.',

        sccContextPartOf: 'Part of a strongly connected component (SCC #%id) of %n modules.',
        sccContextContainsCycles: 'This SCC contains one or more dependency cycles.',
        sccContextOtherMembers: 'Other modules in this SCC:',
        hiddenByFilterNote: '(hidden by filter)',
        hiddenByFocusNote: '(hidden by Focus)',
        moreCountSuffix: ', +%n more',
        focusSccButton: 'Focus SCC',
        showDependencyCycleButton: 'Show a dependency cycle',
        moduleCountParen: '(%n modules)',
        moduleCountVisibleParen: '(%visible of %n modules visible)',

        externalAreaLabel: 'External area: %name',
        externalAreaAggregatedView:
            'Aggregated view of connections between the selected area and %name.',
        externalAreaConnectionsShown: 'Connections shown: %n',
        focusOverflowProxyLabel: '+%n more',
        focusOverflowPanelBody:
            'Showing %visible of %n modules directly connected to this cycle; %hidden more are grouped here to keep the view readable.',
        focusNeighborsTruncatedNote:
            'Showing the %visible most connected of %n direct neighbours - the rest are grouped into a summary node.',

        cycleModalTitle: 'Dependency cycle',
        cycleModalSubtitle: 'One concrete cycle through %module within SCC #%id.',
        cycleModalNote: 'This SCC may contain other dependency cycles.',
        showInGraphButton: 'Show in graph',
        cycleHiddenNoteSingular: '%n module hidden by the current filter.',
        cycleHiddenNotePlural: '%n modules hidden by the current filter.',
        cycleHiddenNoteSingularFocus: '%n module hidden by the current Focus.',
        cycleHiddenNotePluralFocus: '%n modules hidden by the current Focus.',
        cycleFlowBackTo: 'back to',
        cycleModulesHeading: 'Cycle modules',
        closeButton: 'Close',

        eduModalTitle: 'Dependency cycles',
        eduModalWhatIsCycleHeading: 'What is a dependency cycle?',
        eduModalWhatIsCycleBody:
            'A dependency cycle happens when a chain of dependency relationships eventually leads back to a module already reached earlier in the same chain - for example:',
        eduModalExampleCaption:
            'Here, A depends on B, B depends on C, and C depends back on A - closing the chain into a cycle.',
        eduModalWhatIsSccHeading: 'What is an SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer detects cycles by finding Strongly Connected Components (SCCs): an SCC is a group of modules where every module can reach every other module in the group by following dependency relationships.',
        eduModalWhatIsSccBody2:
            'A non-trivial SCC (2 or more modules) always contains at least one dependency cycle - but an SCC is not itself a single cycle. It can contain several distinct cycles that share some of the same modules. This report highlights each detected SCC as a whole, not one specific cycle path within it.',
        eduModalWhyMatterHeading: 'Why can cycles matter?',
        eduModalWhyMatterIntro: 'A dependency cycle may:',
        eduModalWhyMatterItem1:
            'make the dependency relationships between those modules harder to reason about',
        eduModalWhyMatterItem2: 'increase coupling between the modules involved',
        eduModalWhyMatterItem3:
            'make it harder to isolate or reuse a single module from the group on its own',
        eduModalWhyMatterItem4:
            'make changes touch more of the SCC than a change to a single, non-cyclic module would',
        eduModalWhatReportsHeading: 'What does dep-health-analyzer report?',
        eduModalWhatReportsBody:
            "dep-health-analyzer reports the dependency structures it detects in the scanned graph - it does not know this project's intended architecture.",
        eduModalEmphasis: 'A detected cycle or SCC is not automatically an architectural violation.',
        eduModalIntentionalBody:
            "Some cyclic relationships are intentional. Only someone who knows this project's intended architecture can decide whether a specific detected cycle is one worth changing.",
        eduModalHowToInvestigateHeading: 'How to investigate a detected SCC',
        eduModalStep1: 'Select a module that is part of a detected SCC.',
        eduModalStep2: 'Inspect the other modules in that SCC.',
        eduModalStep3: 'Follow the dependency directions between them.',
        eduModalStep4: 'Understand why the relationships exist.',
        eduModalStep5:
            "Decide whether the structure is appropriate for the project's intended architecture.",
    },

    // Straightforward technical translations for a small utility tool's
    // UI - not professionally reviewed by a native speaker. Kept simple
    // deliberately (matches the English source's own plain, short
    // sentences) rather than attempting exact grammatical number
    // agreement for every count, a common simplification in real
    // software localization for exactly this kind of short technical
    // string. Vocabulary reused consistently with the previously-shipped
    // Findings strings (riippuvuus=dependency, moduuli=module, etc.).
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

        layoutLabel: 'Asettelu:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (suorat viivat, ei päällekkäisyyttä)',
        layoutFlowTB: 'Vuokaavio / hierarkkinen (ylhäältä alas)',
        layoutFlowOrthogonal: 'Hierarkkinen (suorakulmainen, ylhäältä alas)',
        layoutFlowOrthogonalLR: 'Hierarkkinen (suorakulmainen, vasemmalta oikealle)',
        layoutFlowVertical: 'Hierarkkinen (suorakulmainen, pystysuora virtaus)',
        layoutBreadthfirst: 'Leveyshaku',
        layoutCose: 'Voimapohjainen asettelu',
        areaLabel: 'Alue:',
        areaAllOption: 'Kaikki',
        connectionsLabel: 'Yhteydet:',
        connectionsInternal: 'Vain sisäiset',
        connectionsExternal: 'Ulkoiset yhteydet mukana',
        fitGraphButton: 'Sovita kaavio',
        showFullGraphButton: 'Näytä koko kaavio',
        zoomOutLabel: 'Loitonna',
        zoomInLabel: 'Lähennä',
        cycleInfoButton: 'Mitä riippuvuussyklit ovat?',
        focusRepresentativeNote: 'Näkymässä %visible / %n tämän SCC:n moduulista - koko SCC on liian suuri näytettäväksi kerralla.',

        detectedSccsHeading: 'Havaitut SCC:t',
        detectedSccsCaption: '(koko analysoitu kaavio, ei nykyinen suodatettu näkymä)',
        noDependencySccsDetected: 'Riippuvuussyklejä sisältäviä SCC:itä ei havaittu.',
        detectedSccsSummary: 'Havaitut SCC:t: %n &middot; Suurin SCC: %largest moduulia.',
        moduleAreaHeading: 'Moduulialue',
        moduleAreaCaption: '(projektin rakenteesta)',
        highlightConnectedToggle: 'Korosta yhdistetyt moduulit',

        hudHelpHoverLine: 'Vie osoitin moduulin päälle nähdäksesi riippuvuusmittarit.',
        hudHelpClickLine: 'Napsauta moduulia <strong>kiinnittääksesi</strong> vihjeen.',
        hudHelpCaExplanation:
            '&mdash; saapuvat riippuvuudet<br />Kuinka moni moduuli riippuu tästä moduulista.',
        hudHelpCeExplanation:
            '&mdash; lähtevät riippuvuudet<br />Kuinka monesta moduulista tämä moduuli riippuu.',
        instabilityLabel: 'Epävakaus',
        hudHelpInstabilityScale: '0.00 = vakaa moduuli<br />1.00 = erittäin epävakaa moduuli',

        sccSizeLabel: 'SCC:n koko',
        hudSelectedEmptyText: 'Napsauta moduulia nähdäksesi tiedot.',

        sccContextPartOf: 'Osa vahvasti yhtenäistä komponenttia (SCC #%id), jossa on %n moduulia.',
        sccContextContainsCycles: 'Tämä SCC sisältää yhden tai useamman riippuvuussyklin.',
        sccContextOtherMembers: 'Muut tämän SCC:n moduulit:',
        hiddenByFilterNote: '(piilotettu suodattimella)',
        hiddenByFocusNote: '(piilotettu kohdistuksella)',
        moreCountSuffix: ', +%n lisää',
        focusSccButton: 'Kohdista SCC:hen',
        showDependencyCycleButton: 'Näytä riippuvuussykli',
        moduleCountParen: '(%n moduulia)',
        moduleCountVisibleParen: '(%visible / %n moduulia näkyvissä)',

        externalAreaLabel: 'Ulkoinen alue: %name',
        externalAreaAggregatedView:
            'Koostettu näkymä valitun alueen ja alueen %name välisistä yhteyksistä.',
        externalAreaConnectionsShown: 'Näytetyt yhteydet: %n',
        focusOverflowProxyLabel: '+%n lisää',
        focusOverflowPanelBody:
            'Näytetään %visible / %n tähän sykliin suoraan liittyvää moduulia; %hidden muuta on koottu tähän näkymän luettavuuden vuoksi.',
        focusNeighborsTruncatedNote:
            'Näytetään %n suorasta naapurista %visible yhteydeltään vahvinta - loput on koottu yhteenvetosolmuun.',

        cycleModalTitle: 'Riippuvuussykli',
        cycleModalSubtitle: 'Yksi konkreettinen sykli moduulin %module kautta, SCC #%id sisällä.',
        cycleModalNote: 'Tämä SCC voi sisältää muitakin riippuvuussyklejä.',
        showInGraphButton: 'Näytä kaaviossa',
        cycleHiddenNoteSingular: '%n moduuli on piilotettu nykyisellä suodattimella.',
        cycleHiddenNotePlural: '%n moduulia on piilotettu nykyisellä suodattimella.',
        cycleHiddenNoteSingularFocus: '%n moduuli on piilotettu nykyisellä kohdistuksella.',
        cycleHiddenNotePluralFocus: '%n moduulia on piilotettu nykyisellä kohdistuksella.',
        cycleFlowBackTo: 'takaisin moduuliin',
        cycleModulesHeading: 'Syklin moduulit',
        closeButton: 'Sulje',

        eduModalTitle: 'Riippuvuussyklit',
        eduModalWhatIsCycleHeading: 'Mikä on riippuvuussykli?',
        eduModalWhatIsCycleBody:
            'Riippuvuussykli syntyy, kun riippuvuussuhteiden ketju johtaa lopulta takaisin moduuliin, joka on jo aiemmin samassa ketjussa - esimerkiksi:',
        eduModalExampleCaption:
            'Tässä A riippuu moduulista B, B riippuu moduulista C, ja C riippuu takaisin moduulista A - ketju sulkeutuu sykliksi.',
        eduModalWhatIsSccHeading: 'Mikä on SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer havaitsee syklit etsimällä vahvasti yhtenäisiä komponentteja (SCC): SCC on joukko moduuleja, joista jokainen voi saavuttaa jokaisen muun ryhmän moduulin riippuvuussuhteita seuraamalla.',
        eduModalWhatIsSccBody2:
            'Ei-triviaali SCC (2 tai useampi moduuli) sisältää aina vähintään yhden riippuvuussyklin - mutta SCC ei itsessään ole yksi sykli. Se voi sisältää useita erillisiä syklejä, jotka jakavat osan samoista moduuleista. Tämä raportti korostaa kunkin havaitun SCC:n kokonaisuutena, ei yhtä tiettyä syklipolkua sen sisällä.',
        eduModalWhyMatterHeading: 'Miksi syklit voivat olla merkityksellisiä?',
        eduModalWhyMatterIntro: 'Riippuvuussykli voi:',
        eduModalWhyMatterItem1:
            'tehdä näiden moduulien välisistä riippuvuussuhteista vaikeammin ymmärrettäviä',
        eduModalWhyMatterItem2: 'lisätä kytkeytyneisyyttä mukana olevien moduulien välillä',
        eduModalWhyMatterItem3:
            'vaikeuttaa yksittäisen moduulin eristämistä tai uudelleenkäyttöä ryhmästä erikseen',
        eduModalWhyMatterItem4:
            'saada muutokset koskettamaan suurempaa osaa SCC:stä kuin muutos yksittäiseen, syklittömään moduuliin',
        eduModalWhatReportsHeading: 'Mitä dep-health-analyzer raportoi?',
        eduModalWhatReportsBody:
            'dep-health-analyzer raportoi skannatusta kaaviosta havaitsemansa riippuvuusrakenteet - se ei tiedä projektin tarkoitettua arkkitehtuuria.',
        eduModalEmphasis: 'Havaittu sykli tai SCC ei automaattisesti ole arkkitehtuuririkkomus.',
        eduModalIntentionalBody:
            'Osa syklisistä suhteista on tarkoituksellisia. Vain projektin tarkoitetun arkkitehtuurin tunteva henkilö voi päättää, kannattaako tiettyä havaittua sykliä muuttaa.',
        eduModalHowToInvestigateHeading: 'Näin tutkit havaittua SCC:tä',
        eduModalStep1: 'Valitse moduuli, joka on osa havaittua SCC:tä.',
        eduModalStep2: 'Tarkastele SCC:n muita moduuleja.',
        eduModalStep3: 'Seuraa niiden välisiä riippuvuussuuntia.',
        eduModalStep4: 'Ymmärrä, miksi suhteet ovat olemassa.',
        eduModalStep5: 'Päätä, sopiiko rakenne projektin tarkoitettuun arkkitehtuuriin.',
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

        layoutLabel: 'Layout:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (raka kanter, ingen överlappning)',
        layoutFlowTB: 'Flöde / hierarkisk (uppifrån och ned)',
        layoutFlowOrthogonal: 'Hierarkisk (ortogonal, uppifrån och ned)',
        layoutFlowOrthogonalLR: 'Hierarkisk (ortogonal, vänster till höger)',
        layoutFlowVertical: 'Hierarkisk (ortogonal, vertikalt flöde)',
        layoutBreadthfirst: 'Bredden först',
        layoutCose: 'Kraftbaserad',
        areaLabel: 'Område:',
        areaAllOption: 'Alla',
        connectionsLabel: 'Anslutningar:',
        connectionsInternal: 'Endast interna',
        connectionsExternal: 'Med externa anslutningar',
        fitGraphButton: 'Anpassa graf',
        showFullGraphButton: 'Visa hela grafen',
        zoomOutLabel: 'Zooma ut',
        zoomInLabel: 'Zooma in',
        cycleInfoButton: 'Vad är beroendecykler?',
        focusRepresentativeNote: 'Visar %visible av %n moduler i denna SCC - hela SCC:n är för stor för att visas på en gång.',

        detectedSccsHeading: 'Upptäckta SCC:er',
        detectedSccsCaption: '(hela den analyserade grafen, inte den aktuella filtrerade vyn)',
        noDependencySccsDetected: 'Inga beroende-SCC:er upptäcktes.',
        detectedSccsSummary: 'Upptäckta SCC:er: %n &middot; Största SCC: %largest moduler.',
        moduleAreaHeading: 'Modulomráde',
        moduleAreaCaption: '(från projektstrukturen)',
        highlightConnectedToggle: 'Markera anslutna moduler',

        hudHelpHoverLine: 'Håll muspekaren över en modul för att se beroendemått.',
        hudHelpClickLine: 'Klicka på en modul <strong>för att fästa</strong> verktygstipset.',
        hudHelpCaExplanation:
            '&mdash; inkommande beroenden<br />Hur många moduler beror på denna modul.',
        hudHelpCeExplanation:
            '&mdash; utgående beroenden<br />Hur många moduler denna modul beror på.',
        instabilityLabel: 'Instabilitet',
        hudHelpInstabilityScale: '0,00 = stabil modul<br />1,00 = mycket instabil modul',

        sccSizeLabel: 'SCC-storlek',
        hudSelectedEmptyText: 'Klicka på en modul för att se detaljer.',

        sccContextPartOf: 'Del av en starkt sammanhängande komponent (SCC #%id) med %n moduler.',
        sccContextContainsCycles: 'Denna SCC innehåller en eller flera beroendecykler.',
        sccContextOtherMembers: 'Andra moduler i denna SCC:',
        hiddenByFilterNote: '(dold av filter)',
        hiddenByFocusNote: '(dold av fokus)',
        moreCountSuffix: ', +%n till',
        focusSccButton: 'Fokusera SCC',
        showDependencyCycleButton: 'Visa en beroendecykel',
        moduleCountParen: '(%n moduler)',
        moduleCountVisibleParen: '(%visible av %n moduler synliga)',

        externalAreaLabel: 'Externt område: %name',
        externalAreaAggregatedView:
            'Aggregerad vy över anslutningar mellan det valda området och %name.',
        externalAreaConnectionsShown: 'Visade anslutningar: %n',
        focusOverflowProxyLabel: '+%n till',
        focusOverflowPanelBody:
            'Visar %visible av %n moduler som är direkt anslutna till denna cykel; %hidden till är grupperade här för att hålla vyn läsbar.',
        focusNeighborsTruncatedNote:
            'Visar de %visible mest anslutna av %n direkta grannar - resten är grupperade i en sammanfattningsnod.',

        cycleModalTitle: 'Beroendecykel',
        cycleModalSubtitle: 'En konkret cykel genom %module inom SCC #%id.',
        cycleModalNote: 'Denna SCC kan innehålla andra beroendecykler.',
        showInGraphButton: 'Visa i grafen',
        cycleHiddenNoteSingular: '%n modul är dold av det aktuella filtret.',
        cycleHiddenNotePlural: '%n moduler är dolda av det aktuella filtret.',
        cycleHiddenNoteSingularFocus: '%n modul är dold av det aktuella fokuset.',
        cycleHiddenNotePluralFocus: '%n moduler är dolda av det aktuella fokuset.',
        cycleFlowBackTo: 'tillbaka till',
        cycleModulesHeading: 'Cykelns moduler',
        closeButton: 'Stäng',

        eduModalTitle: 'Beroendecykler',
        eduModalWhatIsCycleHeading: 'Vad är en beroendecykel?',
        eduModalWhatIsCycleBody:
            'En beroendecykel uppstår när en kedja av beroenderelationer till slut leder tillbaka till en modul som redan nåtts tidigare i samma kedja - till exempel:',
        eduModalExampleCaption:
            'Här beror A på B, B beror på C, och C beror tillbaka på A - vilket sluter kedjan till en cykel.',
        eduModalWhatIsSccHeading: 'Vad är en SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer upptäcker cykler genom att hitta starkt sammanhängande komponenter (SCC): en SCC är en grupp moduler där varje modul kan nå varje annan modul i gruppen genom att följa beroenderelationer.',
        eduModalWhatIsSccBody2:
            'En icke-trivial SCC (2 eller fler moduler) innehåller alltid minst en beroendecykel - men en SCC är inte i sig en enda cykel. Den kan innehålla flera distinkta cykler som delar några av samma moduler. Denna rapport lyfter fram varje upptäckt SCC som helhet, inte en specifik cykelväg inom den.',
        eduModalWhyMatterHeading: 'Varför kan cykler spela roll?',
        eduModalWhyMatterIntro: 'En beroendecykel kan:',
        eduModalWhyMatterItem1: 'göra beroenderelationerna mellan dessa moduler svårare att resonera kring',
        eduModalWhyMatterItem2: 'öka kopplingen mellan de inblandade modulerna',
        eduModalWhyMatterItem3:
            'göra det svårare att isolera eller återanvända en enskild modul från gruppen på egen hand',
        eduModalWhyMatterItem4:
            'göra att ändringar påverkar mer av SCC:n än en ändring i en enskild, cykelfri modul skulle göra',
        eduModalWhatReportsHeading: 'Vad rapporterar dep-health-analyzer?',
        eduModalWhatReportsBody:
            'dep-health-analyzer rapporterar de beroendestrukturer den upptäcker i den skannade grafen - den känner inte till projektets avsedda arkitektur.',
        eduModalEmphasis: 'En upptäckt cykel eller SCC är inte automatiskt ett arkitekturbrott.',
        eduModalIntentionalBody:
            'Vissa cykliska relationer är avsiktliga. Endast någon som känner till projektets avsedda arkitektur kan avgöra om en specifik upptäckt cykel är värd att ändra.',
        eduModalHowToInvestigateHeading: 'Så undersöker du en upptäckt SCC',
        eduModalStep1: 'Välj en modul som ingår i en upptäckt SCC.',
        eduModalStep2: 'Undersök de andra modulerna i den SCC:n.',
        eduModalStep3: 'Följ beroenderiktningarna mellan dem.',
        eduModalStep4: 'Förstå varför relationerna finns.',
        eduModalStep5: 'Avgör om strukturen är lämplig för projektets avsedda arkitektur.',
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

        layoutLabel: 'Oppsett:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (rette linjer, ingen overlapping)',
        layoutFlowTB: 'Flyt / hierarkisk (topp til bunn)',
        layoutFlowOrthogonal: 'Hierarkisk (ortogonal, topp til bunn)',
        layoutFlowOrthogonalLR: 'Hierarkisk (ortogonal, venstre til høyre)',
        layoutFlowVertical: 'Hierarkisk (ortogonal, vertikal flyt)',
        layoutBreadthfirst: 'Bredde først',
        layoutCose: 'Kraftbasert',
        areaLabel: 'Område:',
        areaAllOption: 'Alle',
        connectionsLabel: 'Forbindelser:',
        connectionsInternal: 'Kun interne',
        connectionsExternal: 'Med eksterne forbindelser',
        fitGraphButton: 'Tilpass graf',
        showFullGraphButton: 'Vis hele grafen',
        zoomOutLabel: 'Zoom ut',
        zoomInLabel: 'Zoom inn',
        cycleInfoButton: 'Hva er avhengighetssykluser?',
        focusRepresentativeNote: 'Viser %visible av %n moduler i denne SCC-en - hele SCC-en er for stor til å vises på én gang.',

        detectedSccsHeading: 'Oppdagede SCC-er',
        detectedSccsCaption: '(hele den analyserte grafen, ikke den nåværende filtrerte visningen)',
        noDependencySccsDetected: 'Ingen avhengighets-SCC-er oppdaget.',
        detectedSccsSummary: 'Oppdagede SCC-er: %n &middot; Største SCC: %largest moduler.',
        moduleAreaHeading: 'Modulområde',
        moduleAreaCaption: '(fra prosjektstrukturen)',
        highlightConnectedToggle: 'Fremhev tilkoblede moduler',

        hudHelpHoverLine: 'Hold musepekeren over en modul for å se avhengighetsmålinger.',
        hudHelpClickLine: 'Klikk på en modul for å <strong>feste</strong> verktøytipset.',
        hudHelpCaExplanation:
            '&mdash; innkommende avhengigheter<br />Hvor mange moduler som avhenger av denne modulen.',
        hudHelpCeExplanation:
            '&mdash; utgående avhengigheter<br />Hvor mange moduler denne modulen avhenger av.',
        instabilityLabel: 'Ustabilitet',
        hudHelpInstabilityScale: '0,00 = stabil modul<br />1,00 = svært ustabil modul',

        sccSizeLabel: 'SCC-størrelse',
        hudSelectedEmptyText: 'Klikk på en modul for å se detaljer.',

        sccContextPartOf: 'Del av en sterkt sammenhengende komponent (SCC #%id) med %n moduler.',
        sccContextContainsCycles: 'Denne SCC-en inneholder én eller flere avhengighetssykluser.',
        sccContextOtherMembers: 'Andre moduler i denne SCC-en:',
        hiddenByFilterNote: '(skjult av filter)',
        hiddenByFocusNote: '(skjult av fokus)',
        moreCountSuffix: ', +%n til',
        focusSccButton: 'Fokuser SCC',
        showDependencyCycleButton: 'Vis en avhengighetssyklus',
        moduleCountParen: '(%n moduler)',
        moduleCountVisibleParen: '(%visible av %n moduler synlige)',

        externalAreaLabel: 'Eksternt område: %name',
        externalAreaAggregatedView:
            'Samlet visning av forbindelser mellom det valgte området og %name.',
        externalAreaConnectionsShown: 'Viste forbindelser: %n',
        focusOverflowProxyLabel: '+%n til',
        focusOverflowPanelBody:
            'Viser %visible av %n moduler som er direkte koblet til denne syklusen; %hidden til er gruppert her for å holde visningen lesbar.',
        focusNeighborsTruncatedNote:
            'Viser de %visible mest tilkoblede av %n direkte naboer - resten er gruppert i en oppsummeringsnode.',

        cycleModalTitle: 'Avhengighetssyklus',
        cycleModalSubtitle: 'Én konkret syklus gjennom %module innenfor SCC #%id.',
        cycleModalNote: 'Denne SCC-en kan inneholde andre avhengighetssykluser.',
        showInGraphButton: 'Vis i grafen',
        cycleHiddenNoteSingular: '%n modul er skjult av det gjeldende filteret.',
        cycleHiddenNotePlural: '%n moduler er skjult av det gjeldende filteret.',
        cycleHiddenNoteSingularFocus: '%n modul er skjult av gjeldende fokus.',
        cycleHiddenNotePluralFocus: '%n moduler er skjult av gjeldende fokus.',
        cycleFlowBackTo: 'tilbake til',
        cycleModulesHeading: 'Syklusens moduler',
        closeButton: 'Lukk',

        eduModalTitle: 'Avhengighetssykluser',
        eduModalWhatIsCycleHeading: 'Hva er en avhengighetssyklus?',
        eduModalWhatIsCycleBody:
            'En avhengighetssyklus oppstår når en kjede av avhengighetsforhold til slutt fører tilbake til en modul som allerede er nådd tidligere i samme kjede - for eksempel:',
        eduModalExampleCaption:
            'Her avhenger A av B, B avhenger av C, og C avhenger tilbake av A - dette lukker kjeden til en syklus.',
        eduModalWhatIsSccHeading: 'Hva er en SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer oppdager sykluser ved å finne sterkt sammenhengende komponenter (SCC): en SCC er en gruppe moduler der hver modul kan nå hver annen modul i gruppen ved å følge avhengighetsforhold.',
        eduModalWhatIsSccBody2:
            'En ikke-triviell SCC (2 eller flere moduler) inneholder alltid minst én avhengighetssyklus - men en SCC er ikke i seg selv én syklus. Den kan inneholde flere distinkte sykluser som deler noen av de samme modulene. Denne rapporten fremhever hver oppdagede SCC som helhet, ikke én bestemt sykluskjede innenfor den.',
        eduModalWhyMatterHeading: 'Hvorfor kan sykluser ha betydning?',
        eduModalWhyMatterIntro: 'En avhengighetssyklus kan:',
        eduModalWhyMatterItem1:
            'gjøre avhengighetsforholdene mellom disse modulene vanskeligere å resonnere om',
        eduModalWhyMatterItem2: 'øke koblingen mellom de involverte modulene',
        eduModalWhyMatterItem3:
            'gjøre det vanskeligere å isolere eller gjenbruke en enkelt modul fra gruppen på egen hånd',
        eduModalWhyMatterItem4:
            'gjøre at endringer berører mer av SCC-en enn en endring i en enkelt, syklusfri modul ville gjort',
        eduModalWhatReportsHeading: 'Hva rapporterer dep-health-analyzer?',
        eduModalWhatReportsBody:
            'dep-health-analyzer rapporterer avhengighetsstrukturene den oppdager i den skannede grafen - den kjenner ikke til prosjektets tiltenkte arkitektur.',
        eduModalEmphasis: 'En oppdaget syklus eller SCC er ikke automatisk et arkitekturbrudd.',
        eduModalIntentionalBody:
            'Noen sykliske forhold er tilsiktede. Bare noen som kjenner prosjektets tiltenkte arkitektur kan avgjøre om en bestemt oppdaget syklus er verdt å endre.',
        eduModalHowToInvestigateHeading: 'Slik undersøker du en oppdaget SCC',
        eduModalStep1: 'Velg en modul som er del av en oppdaget SCC.',
        eduModalStep2: 'Undersøk de andre modulene i den SCC-en.',
        eduModalStep3: 'Følg avhengighetsretningene mellom dem.',
        eduModalStep4: 'Forstå hvorfor forholdene finnes.',
        eduModalStep5: 'Avgjør om strukturen passer for prosjektets tiltenkte arkitektur.',
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

        layoutLabel: 'Layout:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (lige linjer, ingen overlap)',
        layoutFlowTB: 'Flow / hierarkisk (top til bund)',
        layoutFlowOrthogonal: 'Hierarkisk (ortogonal, top til bund)',
        layoutFlowOrthogonalLR: 'Hierarkisk (ortogonal, venstre til højre)',
        layoutFlowVertical: 'Hierarkisk (ortogonal, vertikalt flow)',
        layoutBreadthfirst: 'Bredde-først',
        layoutCose: 'Kraftbaseret',
        areaLabel: 'Område:',
        areaAllOption: 'Alle',
        connectionsLabel: 'Forbindelser:',
        connectionsInternal: 'Kun interne',
        connectionsExternal: 'Med eksterne forbindelser',
        fitGraphButton: 'Tilpas graf',
        showFullGraphButton: 'Vis hele grafen',
        zoomOutLabel: 'Zoom ud',
        zoomInLabel: 'Zoom ind',
        cycleInfoButton: 'Hvad er afhængighedscyklusser?',
        focusRepresentativeNote: 'Viser %visible af %n moduler i denne SCC - hele SCC\'en er for stor til at blive vist på én gang.',

        detectedSccsHeading: 'Fundne SCC\'er',
        detectedSccsCaption: '(hele den analyserede graf, ikke den aktuelle filtrerede visning)',
        noDependencySccsDetected: 'Ingen afhængigheds-SCC\'er fundet.',
        detectedSccsSummary: 'Fundne SCC\'er: %n &middot; Største SCC: %largest moduler.',
        moduleAreaHeading: 'Modulområde',
        moduleAreaCaption: '(fra projektstrukturen)',
        highlightConnectedToggle: 'Fremhæv forbundne moduler',

        hudHelpHoverLine: 'Hold musen over et modul for at se afhængighedsmål.',
        hudHelpClickLine: 'Klik på et modul for at <strong>fastgøre</strong> værktøjstippet.',
        hudHelpCaExplanation:
            '&mdash; indgående afhængigheder<br />Hvor mange moduler afhænger af dette modul.',
        hudHelpCeExplanation:
            '&mdash; udgående afhængigheder<br />Hvor mange moduler dette modul afhænger af.',
        instabilityLabel: 'Ustabilitet',
        hudHelpInstabilityScale: '0,00 = stabilt modul<br />1,00 = meget ustabilt modul',

        sccSizeLabel: 'SCC-størrelse',
        hudSelectedEmptyText: 'Klik på et modul for at se detaljer.',

        sccContextPartOf: 'Del af en stærkt sammenhængende komponent (SCC #%id) med %n moduler.',
        sccContextContainsCycles: 'Denne SCC indeholder én eller flere afhængighedscyklusser.',
        sccContextOtherMembers: 'Andre moduler i denne SCC:',
        hiddenByFilterNote: '(skjult af filter)',
        hiddenByFocusNote: '(skjult af fokus)',
        moreCountSuffix: ', +%n mere',
        focusSccButton: 'Fokusér SCC',
        showDependencyCycleButton: 'Vis en afhængighedscyklus',
        moduleCountParen: '(%n moduler)',
        moduleCountVisibleParen: '(%visible af %n moduler synlige)',

        externalAreaLabel: 'Eksternt område: %name',
        externalAreaAggregatedView:
            'Samlet visning af forbindelser mellem det valgte område og %name.',
        externalAreaConnectionsShown: 'Viste forbindelser: %n',
        focusOverflowProxyLabel: '+%n mere',
        focusOverflowPanelBody:
            'Viser %visible af %n moduler, der er direkte forbundet med denne cyklus; %hidden mere er grupperet her for at holde visningen læsbar.',
        focusNeighborsTruncatedNote:
            'Viser de %visible mest forbundne af %n direkte naboer - resten er grupperet i en opsummeringsknude.',

        cycleModalTitle: 'Afhængighedscyklus',
        cycleModalSubtitle: 'Én konkret cyklus gennem %module inden for SCC #%id.',
        cycleModalNote: 'Denne SCC kan indeholde andre afhængighedscyklusser.',
        showInGraphButton: 'Vis i grafen',
        cycleHiddenNoteSingular: '%n modul er skjult af det aktuelle filter.',
        cycleHiddenNotePlural: '%n moduler er skjult af det aktuelle filter.',
        cycleHiddenNoteSingularFocus: '%n modul er skjult af det aktuelle fokus.',
        cycleHiddenNotePluralFocus: '%n moduler er skjult af det aktuelle fokus.',
        cycleFlowBackTo: 'tilbage til',
        cycleModulesHeading: 'Cyklussens moduler',
        closeButton: 'Luk',

        eduModalTitle: 'Afhængighedscyklusser',
        eduModalWhatIsCycleHeading: 'Hvad er en afhængighedscyklus?',
        eduModalWhatIsCycleBody:
            'En afhængighedscyklus opstår, når en kæde af afhængighedsforhold til sidst fører tilbage til et modul, der allerede er nået tidligere i samme kæde - for eksempel:',
        eduModalExampleCaption:
            'Her afhænger A af B, B afhænger af C, og C afhænger tilbage af A - hvilket lukker kæden til en cyklus.',
        eduModalWhatIsSccHeading: 'Hvad er en SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer finder cyklusser ved at finde stærkt sammenhængende komponenter (SCC): en SCC er en gruppe moduler, hvor hvert modul kan nå hvert andet modul i gruppen ved at følge afhængighedsforhold.',
        eduModalWhatIsSccBody2:
            'En ikke-triviel SCC (2 eller flere moduler) indeholder altid mindst én afhængighedscyklus - men en SCC er ikke i sig selv én cyklus. Den kan indeholde flere forskellige cyklusser, der deler nogle af de samme moduler. Denne rapport fremhæver hver fundne SCC som helhed, ikke én bestemt cyklussti inden i den.',
        eduModalWhyMatterHeading: 'Hvorfor kan cyklusser have betydning?',
        eduModalWhyMatterIntro: 'En afhængighedscyklus kan:',
        eduModalWhyMatterItem1:
            'gøre afhængighedsforholdene mellem disse moduler sværere at ræsonnere om',
        eduModalWhyMatterItem2: 'øge koblingen mellem de involverede moduler',
        eduModalWhyMatterItem3:
            'gøre det sværere at isolere eller genbruge et enkelt modul fra gruppen alene',
        eduModalWhyMatterItem4:
            'gøre at ændringer påvirker mere af SCC\'en, end en ændring i et enkelt, cyklusfrit modul ville gøre',
        eduModalWhatReportsHeading: 'Hvad rapporterer dep-health-analyzer?',
        eduModalWhatReportsBody:
            'dep-health-analyzer rapporterer de afhængighedsstrukturer, den finder i den skannede graf - den kender ikke projektets tilsigtede arkitektur.',
        eduModalEmphasis: 'En fundet cyklus eller SCC er ikke automatisk et arkitekturbrud.',
        eduModalIntentionalBody:
            'Nogle cykliske forhold er tilsigtede. Kun en person, der kender projektets tilsigtede arkitektur, kan afgøre, om en bestemt fundet cyklus er værd at ændre.',
        eduModalHowToInvestigateHeading: 'Sådan undersøger du en fundet SCC',
        eduModalStep1: 'Vælg et modul, der er del af en fundet SCC.',
        eduModalStep2: 'Undersøg de andre moduler i den SCC.',
        eduModalStep3: 'Følg afhængighedsretningerne mellem dem.',
        eduModalStep4: 'Forstå hvorfor forholdene findes.',
        eduModalStep5: 'Afgør om strukturen passer til projektets tilsigtede arkitektur.',
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

        layoutLabel: 'Uppsetning:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (beinar línur, engin skörun)',
        layoutFlowTB: 'Flæði / stigskipt (ofan frá og niður)',
        layoutFlowOrthogonal: 'Stigskipt (rétthyrnt, ofan frá og niður)',
        layoutFlowOrthogonalLR: 'Stigskipt (rétthyrnt, vinstri til hægri)',
        layoutFlowVertical: 'Stigskipt (rétthyrnt, lóðrétt flæði)',
        layoutBreadthfirst: 'Breiddarleit',
        layoutCose: 'Kraftmiðuð uppsetning',
        areaLabel: 'Svæði:',
        areaAllOption: 'Allt',
        connectionsLabel: 'Tengingar:',
        connectionsInternal: 'Aðeins innri',
        connectionsExternal: 'Með ytri tengingum',
        fitGraphButton: 'Passa graf',
        showFullGraphButton: 'Sýna allt grafið',
        zoomOutLabel: 'Rýma út',
        zoomInLabel: 'Rýma inn',
        cycleInfoButton: 'Hvað eru hringrásir ósjálfstæða?',
        focusRepresentativeNote: 'Sýnir %visible af %n einingum í þessari SCC - öll SCC-in er of stór til að sýna í einu.',

        detectedSccsHeading: 'Fundnir SCC-hlutar',
        detectedSccsCaption: '(allt greint graf, ekki núverandi síuð sýn)',
        noDependencySccsDetected: 'Engir SCC-hlutar með hringrásum fundust.',
        detectedSccsSummary: 'Fundnir SCC-hlutar: %n &middot; Stærsti SCC: %largest einingar.',
        moduleAreaHeading: 'Einingasvæði',
        moduleAreaCaption: '(úr uppbyggingu verkefnisins)',
        highlightConnectedToggle: 'Auðkenna tengdar einingar',

        hudHelpHoverLine: 'Settu bendilinn yfir einingu til að sjá ósjálfstæðistölur.',
        hudHelpClickLine: 'Smelltu á einingu til að <strong>festa</strong> vísbendinguna.',
        hudHelpCaExplanation:
            '&mdash; innkomandi ósjálfstæði<br />Hversu margar einingar eru háðar þessari einingu.',
        hudHelpCeExplanation:
            '&mdash; útfarandi ósjálfstæði<br />Hversu margar einingar þessi eining er háð.',
        instabilityLabel: 'Óstöðugleiki',
        hudHelpInstabilityScale: '0,00 = stöðug eining<br />1,00 = mjög óstöðug eining',

        sccSizeLabel: 'Stærð SCC',
        hudSelectedEmptyText: 'Smelltu á einingu til að sjá nánar.',

        sccContextPartOf: 'Hluti af sterklega tengdum hluta (SCC #%id) með %n einingar.',
        sccContextContainsCycles: 'Þessi SCC inniheldur eina eða fleiri hringrásir ósjálfstæða.',
        sccContextOtherMembers: 'Aðrar einingar í þessum SCC:',
        hiddenByFilterNote: '(falið vegna síu)',
        hiddenByFocusNote: '(falið vegna fókus)',
        moreCountSuffix: ', +%n í viðbót',
        focusSccButton: 'Fókusa SCC',
        showDependencyCycleButton: 'Sýna hringrás ósjálfstæða',
        moduleCountParen: '(%n einingar)',
        moduleCountVisibleParen: '(%visible af %n einingum sýnilegar)',

        externalAreaLabel: 'Ytra svæði: %name',
        externalAreaAggregatedView: 'Samantekin sýn tenginga milli valda svæðisins og %name.',
        externalAreaConnectionsShown: 'Sýndar tengingar: %n',
        focusOverflowProxyLabel: '+%n til viðbótar',
        focusOverflowPanelBody:
            'Sýnir %visible af %n einingum sem eru beintengdar þessari hringrás; %hidden til viðbótar eru flokkaðar hér til að halda sýninni læsilegri.',
        focusNeighborsTruncatedNote:
            'Sýnir %visible mest tengdu af %n beinum nágrönnum - restin er flokkuð í samantektarhnút.',

        cycleModalTitle: 'Hringrás ósjálfstæða',
        cycleModalSubtitle: 'Ein áþreifanleg hringrás í gegnum %module innan SCC #%id.',
        cycleModalNote: 'Þessi SCC getur innihaldið aðrar hringrásir ósjálfstæða.',
        showInGraphButton: 'Sýna í grafi',
        cycleHiddenNoteSingular: '%n eining er falin vegna núverandi síu.',
        cycleHiddenNotePlural: '%n einingar eru faldar vegna núverandi síu.',
        cycleHiddenNoteSingularFocus: '%n eining er falin vegna núverandi fókus.',
        cycleHiddenNotePluralFocus: '%n einingar eru faldar vegna núverandi fókus.',
        cycleFlowBackTo: 'til baka í',
        cycleModulesHeading: 'Einingar hringrásarinnar',
        closeButton: 'Loka',

        eduModalTitle: 'Hringrásir ósjálfstæða',
        eduModalWhatIsCycleHeading: 'Hvað er hringrás ósjálfstæða?',
        eduModalWhatIsCycleBody:
            'Hringrás ósjálfstæða verður til þegar keðja ósjálfstæðistengsla leiðir að lokum aftur til einingar sem þegar hefur verið náð fyrr í sömu keðju - til dæmis:',
        eduModalExampleCaption:
            'Hér er A háð B, B er háð C, og C er háð A aftur - sem lokar keðjunni í hringrás.',
        eduModalWhatIsSccHeading: 'Hvað er SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer finnur hringrásir með því að finna sterklega tengda hluta (SCC): SCC er hópur eininga þar sem hver eining getur náð til hverrar annarrar einingar í hópnum með því að fylgja ósjálfstæðistengslum.',
        eduModalWhatIsSccBody2:
            'SCC sem er ekki léttvægur (2 eða fleiri einingar) inniheldur alltaf að minnsta kosti eina hringrás ósjálfstæða - en SCC er ekki sjálf ein hringrás. Hún getur innihaldið nokkrar aðgreindar hringrásir sem deila sumum sömu einingum. Þessi skýrsla dregur fram hvern fundinn SCC í heild, ekki eina tiltekna hringrásarleið innan hans.',
        eduModalWhyMatterHeading: 'Af hverju geta hringrásir skipt máli?',
        eduModalWhyMatterIntro: 'Hringrás ósjálfstæða getur:',
        eduModalWhyMatterItem1:
            'gert ósjálfstæðistengslin milli þessara eininga erfiðari að skilja',
        eduModalWhyMatterItem2: 'aukið tengingu milli hlutaðeigandi eininga',
        eduModalWhyMatterItem3:
            'gert erfiðara að einangra eða endurnýta staka einingu úr hópnum sjálfstætt',
        eduModalWhyMatterItem4:
            'valdið því að breytingar snerta meira af SCC-inu en breyting á einni, hringrásarlausri einingu myndi gera',
        eduModalWhatReportsHeading: 'Hvað greinir dep-health-analyzer frá?',
        eduModalWhatReportsBody:
            'dep-health-analyzer greinir frá ósjálfstæðisskipulaginu sem hún finnur í skannaða grafinu - hún þekkir ekki ætlaða arkitektúr verkefnisins.',
        eduModalEmphasis: 'Fundin hringrás eða SCC er ekki sjálfkrafa arkitektúrbrot.',
        eduModalIntentionalBody:
            'Sum hringlaga tengsl eru ásetningur. Aðeins sá sem þekkir ætlaðan arkitektúr verkefnisins getur ákveðið hvort tiltekin fundin hringrás sé þess virði að breyta.',
        eduModalHowToInvestigateHeading: 'Hvernig á að rannsaka fundinn SCC',
        eduModalStep1: 'Veldu einingu sem er hluti af fundnum SCC.',
        eduModalStep2: 'Skoðaðu hinar einingarnar í þeim SCC.',
        eduModalStep3: 'Fylgdu ósjálfstæðisstefnunum milli þeirra.',
        eduModalStep4: 'Skildu hvers vegna tengslin eru til staðar.',
        eduModalStep5: 'Ákveddu hvort skipulagið henti ætluðum arkitektúr verkefnisins.',
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

        layoutLabel: 'Layout:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (gerade Kanten, keine Überlappung)',
        layoutFlowTB: 'Fluss / hierarchisch (oben nach unten)',
        layoutFlowOrthogonal: 'Hierarchisch (orthogonal, oben nach unten)',
        layoutFlowOrthogonalLR: 'Hierarchisch (orthogonal, links nach rechts)',
        layoutFlowVertical: 'Hierarchisch (orthogonal, vertikaler Fluss)',
        layoutBreadthfirst: 'Breitensuche',
        layoutCose: 'Kraftbasiert',
        areaLabel: 'Bereich:',
        areaAllOption: 'Alle',
        connectionsLabel: 'Verbindungen:',
        connectionsInternal: 'Nur intern',
        connectionsExternal: 'Mit externen Verbindungen',
        fitGraphButton: 'Graph einpassen',
        showFullGraphButton: 'Gesamten Graph anzeigen',
        zoomOutLabel: 'Verkleinern',
        zoomInLabel: 'Vergrößern',
        cycleInfoButton: 'Was sind Abhängigkeitszyklen?',
        focusRepresentativeNote: 'Es werden %visible von %n Modulen dieser SCC angezeigt - die vollständige SCC ist zu groß, um auf einmal dargestellt zu werden.',

        detectedSccsHeading: 'Erkannte SCCs',
        detectedSccsCaption: '(gesamter analysierter Graph, nicht die aktuell gefilterte Ansicht)',
        noDependencySccsDetected: 'Keine Abhängigkeits-SCCs erkannt.',
        detectedSccsSummary: 'Erkannte SCCs: %n &middot; Größte SCC: %largest Module.',
        moduleAreaHeading: 'Modulbereich',
        moduleAreaCaption: '(aus der Projektstruktur)',
        highlightConnectedToggle: 'Verbundene Module hervorheben',

        hudHelpHoverLine: 'Zeigen Sie auf ein Modul, um Abhängigkeitskennzahlen zu sehen.',
        hudHelpClickLine: 'Klicken Sie auf ein Modul, um den Tooltip <strong>anzuheften</strong>.',
        hudHelpCaExplanation:
            '&mdash; eingehende Abhängigkeiten<br />Wie viele Module von diesem Modul abhängen.',
        hudHelpCeExplanation:
            '&mdash; ausgehende Abhängigkeiten<br />Von wie vielen Modulen dieses Modul abhängt.',
        instabilityLabel: 'Instabilität',
        hudHelpInstabilityScale: '0,00 = stabiles Modul<br />1,00 = sehr instabiles Modul',

        sccSizeLabel: 'SCC-Größe',
        hudSelectedEmptyText: 'Klicken Sie auf ein Modul, um Details anzuzeigen.',

        sccContextPartOf: 'Teil einer stark zusammenhängenden Komponente (SCC #%id) mit %n Modulen.',
        sccContextContainsCycles: 'Diese SCC enthält einen oder mehrere Abhängigkeitszyklen.',
        sccContextOtherMembers: 'Andere Module in dieser SCC:',
        hiddenByFilterNote: '(durch Filter ausgeblendet)',
        hiddenByFocusNote: '(durch Fokus ausgeblendet)',
        moreCountSuffix: ', +%n weitere',
        focusSccButton: 'SCC fokussieren',
        showDependencyCycleButton: 'Abhängigkeitszyklus anzeigen',
        moduleCountParen: '(%n Module)',
        moduleCountVisibleParen: '(%visible von %n Modulen sichtbar)',

        externalAreaLabel: 'Externer Bereich: %name',
        externalAreaAggregatedView:
            'Zusammengefasste Ansicht der Verbindungen zwischen dem ausgewählten Bereich und %name.',
        externalAreaConnectionsShown: 'Angezeigte Verbindungen: %n',
        focusOverflowProxyLabel: '+%n weitere',
        focusOverflowPanelBody:
            'Zeigt %visible von %n Modulen, die direkt mit diesem Zyklus verbunden sind; %hidden weitere sind hier zusammengefasst, damit die Ansicht lesbar bleibt.',
        focusNeighborsTruncatedNote:
            'Zeigt die %visible am stärksten verbundenen von %n direkten Nachbarn - der Rest ist in einem Sammelknoten zusammengefasst.',

        cycleModalTitle: 'Abhängigkeitszyklus',
        cycleModalSubtitle: 'Ein konkreter Zyklus durch %module innerhalb von SCC #%id.',
        cycleModalNote: 'Diese SCC kann weitere Abhängigkeitszyklen enthalten.',
        showInGraphButton: 'Im Graph anzeigen',
        cycleHiddenNoteSingular: '%n Modul ist durch den aktuellen Filter ausgeblendet.',
        cycleHiddenNotePlural: '%n Module sind durch den aktuellen Filter ausgeblendet.',
        cycleHiddenNoteSingularFocus: '%n Modul ist durch den aktuellen Fokus ausgeblendet.',
        cycleHiddenNotePluralFocus: '%n Module sind durch den aktuellen Fokus ausgeblendet.',
        cycleFlowBackTo: 'zurück zu',
        cycleModulesHeading: 'Module des Zyklus',
        closeButton: 'Schließen',

        eduModalTitle: 'Abhängigkeitszyklen',
        eduModalWhatIsCycleHeading: 'Was ist ein Abhängigkeitszyklus?',
        eduModalWhatIsCycleBody:
            'Ein Abhängigkeitszyklus entsteht, wenn eine Kette von Abhängigkeitsbeziehungen schließlich zu einem Modul zurückführt, das bereits früher in derselben Kette erreicht wurde - zum Beispiel:',
        eduModalExampleCaption:
            'Hier hängt A von B ab, B hängt von C ab, und C hängt wieder von A ab - wodurch sich die Kette zu einem Zyklus schließt.',
        eduModalWhatIsSccHeading: 'Was ist eine SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer erkennt Zyklen, indem es stark zusammenhängende Komponenten (SCCs) findet: Eine SCC ist eine Gruppe von Modulen, in der jedes Modul jedes andere Modul der Gruppe über Abhängigkeitsbeziehungen erreichen kann.',
        eduModalWhatIsSccBody2:
            'Eine nicht-triviale SCC (2 oder mehr Module) enthält immer mindestens einen Abhängigkeitszyklus - aber eine SCC ist selbst kein einzelner Zyklus. Sie kann mehrere verschiedene Zyklen enthalten, die sich einige der gleichen Module teilen. Dieser Bericht hebt jede erkannte SCC als Ganzes hervor, nicht einen bestimmten Zykluspfad darin.',
        eduModalWhyMatterHeading: 'Warum können Zyklen wichtig sein?',
        eduModalWhyMatterIntro: 'Ein Abhängigkeitszyklus kann:',
        eduModalWhyMatterItem1:
            'die Abhängigkeitsbeziehungen zwischen diesen Modulen schwerer nachvollziehbar machen',
        eduModalWhyMatterItem2: 'die Kopplung zwischen den beteiligten Modulen erhöhen',
        eduModalWhyMatterItem3:
            'es erschweren, ein einzelnes Modul isoliert aus der Gruppe zu verwenden oder wiederzuverwenden',
        eduModalWhyMatterItem4:
            'dazu führen, dass Änderungen einen größeren Teil der SCC betreffen als eine Änderung an einem einzelnen, zyklusfreien Modul',
        eduModalWhatReportsHeading: 'Was meldet dep-health-analyzer?',
        eduModalWhatReportsBody:
            'dep-health-analyzer meldet die Abhängigkeitsstrukturen, die es im gescannten Graphen erkennt - es kennt die beabsichtigte Architektur dieses Projekts nicht.',
        eduModalEmphasis: 'Ein erkannter Zyklus oder eine SCC ist nicht automatisch ein Architekturverstoß.',
        eduModalIntentionalBody:
            'Manche zyklischen Beziehungen sind beabsichtigt. Nur jemand, der die beabsichtigte Architektur des Projekts kennt, kann entscheiden, ob ein bestimmter erkannter Zyklus geändert werden sollte.',
        eduModalHowToInvestigateHeading: 'So untersuchen Sie eine erkannte SCC',
        eduModalStep1: 'Wählen Sie ein Modul aus, das Teil einer erkannten SCC ist.',
        eduModalStep2: 'Untersuchen Sie die anderen Module in dieser SCC.',
        eduModalStep3: 'Folgen Sie den Abhängigkeitsrichtungen zwischen ihnen.',
        eduModalStep4: 'Verstehen Sie, warum die Beziehungen bestehen.',
        eduModalStep5: 'Entscheiden Sie, ob die Struktur zur beabsichtigten Architektur des Projekts passt.',
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

        layoutLabel: 'Disposition :',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (arêtes droites, sans chevauchement)',
        layoutFlowTB: 'Flux / hiérarchique (haut en bas)',
        layoutFlowOrthogonal: 'Hiérarchique (orthogonal, haut en bas)',
        layoutFlowOrthogonalLR: 'Hiérarchique (orthogonal, gauche à droite)',
        layoutFlowVertical: 'Hiérarchique (orthogonal, flux vertical)',
        layoutBreadthfirst: 'Parcours en largeur',
        layoutCose: 'Basé sur les forces',
        areaLabel: 'Zone :',
        areaAllOption: 'Toutes',
        connectionsLabel: 'Connexions :',
        connectionsInternal: 'Internes uniquement',
        connectionsExternal: 'Avec connexions externes',
        fitGraphButton: 'Ajuster le graphe',
        showFullGraphButton: 'Afficher le graphe complet',
        zoomOutLabel: 'Zoom arrière',
        zoomInLabel: 'Zoom avant',
        cycleInfoButton: 'Que sont les cycles de dépendances ?',
        focusRepresentativeNote: 'Affiche %visible modules sur %n dans ce SCC - le SCC complet est trop volumineux pour être affiché en une seule fois.',

        detectedSccsHeading: 'SCC détectés',
        detectedSccsCaption: "(l'ensemble du graphe analysé, pas la vue filtrée actuelle)",
        noDependencySccsDetected: 'Aucun SCC de dépendances détecté.',
        detectedSccsSummary: 'SCC détectés : %n &middot; Plus grand SCC : %largest modules.',
        moduleAreaHeading: 'Zone du module',
        moduleAreaCaption: '(à partir de la structure du projet)',
        highlightConnectedToggle: 'Mettre en évidence les modules connectés',

        hudHelpHoverLine: 'Survolez un module pour voir les indicateurs de dépendance.',
        hudHelpClickLine: 'Cliquez sur un module pour <strong>épingler</strong> l\'infobulle.',
        hudHelpCaExplanation:
            '&mdash; dépendances entrantes<br />Combien de modules dépendent de ce module.',
        hudHelpCeExplanation:
            '&mdash; dépendances sortantes<br />De combien de modules ce module dépend.',
        instabilityLabel: 'Instabilité',
        hudHelpInstabilityScale: '0,00 = module stable<br />1,00 = module très instable',

        sccSizeLabel: 'Taille du SCC',
        hudSelectedEmptyText: 'Cliquez sur un module pour voir les détails.',

        sccContextPartOf:
            'Fait partie d\'une composante fortement connexe (SCC n&deg;%id) de %n modules.',
        sccContextContainsCycles: 'Ce SCC contient un ou plusieurs cycles de dépendances.',
        sccContextOtherMembers: 'Autres modules de ce SCC :',
        hiddenByFilterNote: '(masqué par le filtre)',
        hiddenByFocusNote: '(masqué par le Focus)',
        moreCountSuffix: ', +%n de plus',
        focusSccButton: 'Focaliser le SCC',
        showDependencyCycleButton: 'Afficher un cycle de dépendances',
        moduleCountParen: '(%n modules)',
        moduleCountVisibleParen: '(%visible sur %n modules visibles)',

        externalAreaLabel: 'Zone externe : %name',
        externalAreaAggregatedView:
            'Vue agrégée des connexions entre la zone sélectionnée et %name.',
        externalAreaConnectionsShown: 'Connexions affichées : %n',
        focusOverflowProxyLabel: '+%n de plus',
        focusOverflowPanelBody:
            'Affiche %visible modules sur %n directement connectés à ce cycle ; %hidden de plus sont regroupés ici pour garder la vue lisible.',
        focusNeighborsTruncatedNote:
            'Affiche les %visible voisins directs les plus connectés sur %n ; le reste est regroupé dans un nœud récapitulatif.',

        cycleModalTitle: 'Cycle de dépendances',
        cycleModalSubtitle: 'Un cycle concret à travers %module au sein du SCC n&deg;%id.',
        cycleModalNote: "Ce SCC peut contenir d'autres cycles de dépendances.",
        showInGraphButton: 'Afficher dans le graphe',
        cycleHiddenNoteSingular: '%n module est masqué par le filtre actuel.',
        cycleHiddenNotePlural: '%n modules sont masqués par le filtre actuel.',
        cycleHiddenNoteSingularFocus: '%n module est masqué par le Focus actuel.',
        cycleHiddenNotePluralFocus: '%n modules sont masqués par le Focus actuel.',
        cycleFlowBackTo: 'retour à',
        cycleModulesHeading: 'Modules du cycle',
        closeButton: 'Fermer',

        eduModalTitle: 'Cycles de dépendances',
        eduModalWhatIsCycleHeading: "Qu'est-ce qu'un cycle de dépendances ?",
        eduModalWhatIsCycleBody:
            "Un cycle de dépendances se produit lorsqu'une chaîne de relations de dépendance finit par revenir à un module déjà atteint plus tôt dans la même chaîne - par exemple :",
        eduModalExampleCaption:
            'Ici, A dépend de B, B dépend de C, et C dépend à nouveau de A - ce qui referme la chaîne en un cycle.',
        eduModalWhatIsSccHeading: "Qu'est-ce qu'un SCC ?",
        eduModalWhatIsSccBody1:
            'dep-health-analyzer détecte les cycles en trouvant des composantes fortement connexes (SCC) : un SCC est un groupe de modules où chaque module peut atteindre chaque autre module du groupe en suivant les relations de dépendance.',
        eduModalWhatIsSccBody2:
            "Un SCC non trivial (2 modules ou plus) contient toujours au moins un cycle de dépendances - mais un SCC n'est pas lui-même un seul cycle. Il peut contenir plusieurs cycles distincts partageant certains des mêmes modules. Ce rapport met en évidence chaque SCC détecté dans son ensemble, pas un chemin de cycle spécifique en son sein.",
        eduModalWhyMatterHeading: 'Pourquoi les cycles peuvent-ils avoir de l\'importance ?',
        eduModalWhyMatterIntro: 'Un cycle de dépendances peut :',
        eduModalWhyMatterItem1:
            'rendre les relations de dépendance entre ces modules plus difficiles à comprendre',
        eduModalWhyMatterItem2: 'augmenter le couplage entre les modules concernés',
        eduModalWhyMatterItem3:
            "rendre plus difficile l'isolation ou la réutilisation d'un seul module du groupe séparément",
        eduModalWhyMatterItem4:
            "faire qu'un changement affecte une plus grande partie du SCC qu'un changement dans un seul module non cyclique",
        eduModalWhatReportsHeading: 'Que rapporte dep-health-analyzer ?',
        eduModalWhatReportsBody:
            "dep-health-analyzer rapporte les structures de dépendance qu'il détecte dans le graphe analysé - il ne connaît pas l'architecture prévue de ce projet.",
        eduModalEmphasis: "Un cycle ou un SCC détecté n'est pas automatiquement une violation architecturale.",
        eduModalIntentionalBody:
            "Certaines relations cycliques sont intentionnelles. Seule une personne connaissant l'architecture prévue du projet peut décider si un cycle détecté spécifique mérite d'être modifié.",
        eduModalHowToInvestigateHeading: 'Comment examiner un SCC détecté',
        eduModalStep1: "Sélectionnez un module faisant partie d'un SCC détecté.",
        eduModalStep2: 'Examinez les autres modules de ce SCC.',
        eduModalStep3: 'Suivez les directions de dépendance entre eux.',
        eduModalStep4: "Comprenez pourquoi les relations existent.",
        eduModalStep5: "Décidez si la structure convient à l'architecture prévue du projet.",
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

        layoutLabel: 'Diseño:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (bordes rectos, sin solapamiento)',
        layoutFlowTB: 'Flujo / jerárquico (de arriba a abajo)',
        layoutFlowOrthogonal: 'Jerárquico (ortogonal, de arriba a abajo)',
        layoutFlowOrthogonalLR: 'Jerárquico (ortogonal, de izquierda a derecha)',
        layoutFlowVertical: 'Jerárquico (ortogonal, flujo vertical)',
        layoutBreadthfirst: 'Primero en anchura',
        layoutCose: 'Basado en fuerzas',
        areaLabel: 'Área:',
        areaAllOption: 'Todas',
        connectionsLabel: 'Conexiones:',
        connectionsInternal: 'Solo internas',
        connectionsExternal: 'Con conexiones externas',
        fitGraphButton: 'Ajustar grafo',
        showFullGraphButton: 'Mostrar grafo completo',
        zoomOutLabel: 'Alejar',
        zoomInLabel: 'Acercar',
        cycleInfoButton: '¿Qué son los ciclos de dependencias?',
        focusRepresentativeNote: 'Se muestran %visible de %n módulos de este SCC - el SCC completo es demasiado grande para mostrarse de una vez.',

        detectedSccsHeading: 'SCC detectados',
        detectedSccsCaption: '(todo el grafo analizado, no la vista filtrada actual)',
        noDependencySccsDetected: 'No se detectaron SCC de dependencias.',
        detectedSccsSummary: 'SCC detectados: %n &middot; SCC más grande: %largest módulos.',
        moduleAreaHeading: 'Área del módulo',
        moduleAreaCaption: '(a partir de la estructura del proyecto)',
        highlightConnectedToggle: 'Resaltar módulos conectados',

        hudHelpHoverLine: 'Pase el cursor sobre un módulo para ver las métricas de dependencia.',
        hudHelpClickLine: 'Haga clic en un módulo para <strong>fijar</strong> la información.',
        hudHelpCaExplanation:
            '&mdash; dependencias entrantes<br />Cuántos módulos dependen de este módulo.',
        hudHelpCeExplanation:
            '&mdash; dependencias salientes<br />De cuántos módulos depende este módulo.',
        instabilityLabel: 'Inestabilidad',
        hudHelpInstabilityScale: '0,00 = módulo estable<br />1,00 = módulo muy inestable',

        sccSizeLabel: 'Tamaño del SCC',
        hudSelectedEmptyText: 'Haga clic en un módulo para ver los detalles.',

        sccContextPartOf:
            'Forma parte de un componente fuertemente conexo (SCC n.&ordm;%id) de %n módulos.',
        sccContextContainsCycles: 'Este SCC contiene uno o más ciclos de dependencias.',
        sccContextOtherMembers: 'Otros módulos de este SCC:',
        hiddenByFilterNote: '(oculto por el filtro)',
        hiddenByFocusNote: '(oculto por el enfoque)',
        moreCountSuffix: ', +%n más',
        focusSccButton: 'Enfocar SCC',
        showDependencyCycleButton: 'Mostrar un ciclo de dependencias',
        moduleCountParen: '(%n módulos)',
        moduleCountVisibleParen: '(%visible de %n módulos visibles)',

        externalAreaLabel: 'Área externa: %name',
        externalAreaAggregatedView:
            'Vista agregada de las conexiones entre el área seleccionada y %name.',
        externalAreaConnectionsShown: 'Conexiones mostradas: %n',
        focusOverflowProxyLabel: '+%n más',
        focusOverflowPanelBody:
            'Se muestran %visible de %n módulos conectados directamente a este ciclo; %hidden más se agrupan aquí para mantener la vista legible.',
        focusNeighborsTruncatedNote:
            'Se muestran los %visible vecinos directos más conectados de %n; el resto se agrupa en un nodo resumen.',

        cycleModalTitle: 'Ciclo de dependencias',
        cycleModalSubtitle: 'Un ciclo concreto a través de %module dentro del SCC n.&ordm;%id.',
        cycleModalNote: 'Este SCC puede contener otros ciclos de dependencias.',
        showInGraphButton: 'Mostrar en el grafo',
        cycleHiddenNoteSingular: '%n módulo está oculto por el filtro actual.',
        cycleHiddenNotePlural: '%n módulos están ocultos por el filtro actual.',
        cycleHiddenNoteSingularFocus: '%n módulo está oculto por el enfoque actual.',
        cycleHiddenNotePluralFocus: '%n módulos están ocultos por el enfoque actual.',
        cycleFlowBackTo: 'volver a',
        cycleModulesHeading: 'Módulos del ciclo',
        closeButton: 'Cerrar',

        eduModalTitle: 'Ciclos de dependencias',
        eduModalWhatIsCycleHeading: '¿Qué es un ciclo de dependencias?',
        eduModalWhatIsCycleBody:
            'Un ciclo de dependencias ocurre cuando una cadena de relaciones de dependencia acaba volviendo a un módulo ya alcanzado antes en la misma cadena - por ejemplo:',
        eduModalExampleCaption:
            'Aquí, A depende de B, B depende de C, y C depende de nuevo de A - cerrando la cadena en un ciclo.',
        eduModalWhatIsSccHeading: '¿Qué es un SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer detecta ciclos encontrando Componentes Fuertemente Conexos (SCC): un SCC es un grupo de módulos donde cada módulo puede alcanzar a cualquier otro módulo del grupo siguiendo relaciones de dependencia.',
        eduModalWhatIsSccBody2:
            'Un SCC no trivial (2 o más módulos) siempre contiene al menos un ciclo de dependencias - pero un SCC no es en sí mismo un único ciclo. Puede contener varios ciclos distintos que comparten algunos de los mismos módulos. Este informe destaca cada SCC detectado como un todo, no una ruta de ciclo específica dentro de él.',
        eduModalWhyMatterHeading: '¿Por qué pueden importar los ciclos?',
        eduModalWhyMatterIntro: 'Un ciclo de dependencias puede:',
        eduModalWhyMatterItem1:
            'hacer que las relaciones de dependencia entre esos módulos sean más difíciles de entender',
        eduModalWhyMatterItem2: 'aumentar el acoplamiento entre los módulos involucrados',
        eduModalWhyMatterItem3:
            'dificultar aislar o reutilizar un solo módulo del grupo por su cuenta',
        eduModalWhyMatterItem4:
            'hacer que los cambios afecten a más del SCC que un cambio en un único módulo no cíclico',
        eduModalWhatReportsHeading: '¿Qué reporta dep-health-analyzer?',
        eduModalWhatReportsBody:
            'dep-health-analyzer reporta las estructuras de dependencia que detecta en el grafo analizado - no conoce la arquitectura prevista de este proyecto.',
        eduModalEmphasis:
            'Un ciclo o SCC detectado no es automáticamente una violación arquitectónica.',
        eduModalIntentionalBody:
            'Algunas relaciones cíclicas son intencionadas. Solo alguien que conozca la arquitectura prevista del proyecto puede decidir si un ciclo detectado específico merece ser cambiado.',
        eduModalHowToInvestigateHeading: 'Cómo investigar un SCC detectado',
        eduModalStep1: 'Seleccione un módulo que forme parte de un SCC detectado.',
        eduModalStep2: 'Inspeccione los otros módulos de ese SCC.',
        eduModalStep3: 'Siga las direcciones de dependencia entre ellos.',
        eduModalStep4: 'Comprenda por qué existen las relaciones.',
        eduModalStep5: 'Decida si la estructura es apropiada para la arquitectura prevista del proyecto.',
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

        layoutLabel: 'Układ:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (proste krawędzie, bez nakładania)',
        layoutFlowTB: 'Przepływ / hierarchiczny (od góry do dołu)',
        layoutFlowOrthogonal: 'Hierarchiczny (ortogonalny, od góry do dołu)',
        layoutFlowOrthogonalLR: 'Hierarchiczny (ortogonalny, od lewej do prawej)',
        layoutFlowVertical: 'Hierarchiczny (ortogonalny, przepływ pionowy)',
        layoutBreadthfirst: 'Przeszukiwanie wszerz',
        layoutCose: 'Oparty na siłach',
        areaLabel: 'Obszar:',
        areaAllOption: 'Wszystkie',
        connectionsLabel: 'Połączenia:',
        connectionsInternal: 'Tylko wewnętrzne',
        connectionsExternal: 'Z połączeniami zewnętrznymi',
        fitGraphButton: 'Dopasuj graf',
        showFullGraphButton: 'Pokaż cały graf',
        zoomOutLabel: 'Pomniejsz',
        zoomInLabel: 'Powiększ',
        cycleInfoButton: 'Czym są cykle zależności?',
        focusRepresentativeNote: 'Pokazano %visible z %n modułów tego SCC - pełny SCC jest zbyt duży, aby wyświetlić go w całości.',

        detectedSccsHeading: 'Wykryte SCC',
        detectedSccsCaption: '(cały analizowany graf, nie bieżący filtrowany widok)',
        noDependencySccsDetected: 'Nie wykryto SCC zawierających zależności cykliczne.',
        detectedSccsSummary: 'Wykryte SCC: %n &middot; Największe SCC: %largest modułów.',
        moduleAreaHeading: 'Obszar modułu',
        moduleAreaCaption: '(na podstawie struktury projektu)',
        highlightConnectedToggle: 'Podświetl połączone moduły',

        hudHelpHoverLine: 'Najedź na moduł, aby zobaczyć metryki zależności.',
        hudHelpClickLine: 'Kliknij moduł, aby <strong>przypiąć</strong> podpowiedź.',
        hudHelpCaExplanation:
            '&mdash; zależności przychodzące<br />Ile modułów zależy od tego modułu.',
        hudHelpCeExplanation:
            '&mdash; zależności wychodzące<br />Od ilu modułów zależy ten moduł.',
        instabilityLabel: 'Niestabilność',
        hudHelpInstabilityScale: '0,00 = moduł stabilny<br />1,00 = moduł bardzo niestabilny',

        sccSizeLabel: 'Rozmiar SCC',
        hudSelectedEmptyText: 'Kliknij moduł, aby zobaczyć szczegóły.',

        sccContextPartOf: 'Część silnie spójnej składowej (SCC #%id) liczącej %n modułów.',
        sccContextContainsCycles: 'Ten SCC zawiera jeden lub więcej cykli zależności.',
        sccContextOtherMembers: 'Inne moduły w tym SCC:',
        hiddenByFilterNote: '(ukryty przez filtr)',
        hiddenByFocusNote: '(ukryty przez fokus)',
        moreCountSuffix: ', +%n więcej',
        focusSccButton: 'Skoncentruj na SCC',
        showDependencyCycleButton: 'Pokaż cykl zależności',
        moduleCountParen: '(%n modułów)',
        moduleCountVisibleParen: '(%visible z %n modułów widocznych)',

        externalAreaLabel: 'Obszar zewnętrzny: %name',
        externalAreaAggregatedView:
            'Zbiorczy widok połączeń między wybranym obszarem a %name.',
        externalAreaConnectionsShown: 'Wyświetlone połączenia: %n',
        focusOverflowProxyLabel: '+%n więcej',
        focusOverflowPanelBody:
            'Pokazano %visible z %n modułów bezpośrednio połączonych z tym cyklem; %hidden kolejnych zgrupowano tutaj, aby widok pozostał czytelny.',
        focusNeighborsTruncatedNote:
            'Pokazano %visible najbardziej powiązanych z %n bezpośrednich sąsiadów - reszta jest zgrupowana w węźle podsumowującym.',

        cycleModalTitle: 'Cykl zależności',
        cycleModalSubtitle: 'Jeden konkretny cykl przez %module w obrębie SCC #%id.',
        cycleModalNote: 'Ten SCC może zawierać inne cykle zależności.',
        showInGraphButton: 'Pokaż w grafie',
        cycleHiddenNoteSingular: '%n moduł jest ukryty przez bieżący filtr.',
        cycleHiddenNotePlural: '%n modułów jest ukrytych przez bieżący filtr.',
        cycleHiddenNoteSingularFocus: '%n moduł jest ukryty przez bieżący fokus.',
        cycleHiddenNotePluralFocus: '%n modułów jest ukrytych przez bieżący fokus.',
        cycleFlowBackTo: 'z powrotem do',
        cycleModulesHeading: 'Moduły cyklu',
        closeButton: 'Zamknij',

        eduModalTitle: 'Cykle zależności',
        eduModalWhatIsCycleHeading: 'Czym jest cykl zależności?',
        eduModalWhatIsCycleBody:
            'Cykl zależności powstaje, gdy łańcuch relacji zależności ostatecznie prowadzi z powrotem do modułu już wcześniej osiągniętego w tym samym łańcuchu - na przykład:',
        eduModalExampleCaption:
            'Tutaj A zależy od B, B zależy od C, a C zależy z powrotem od A - zamykając łańcuch w cykl.',
        eduModalWhatIsSccHeading: 'Czym jest SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer wykrywa cykle, znajdując silnie spójne składowe (SCC): SCC to grupa modułów, w której każdy moduł może dotrzeć do każdego innego modułu w grupie, podążając za relacjami zależności.',
        eduModalWhatIsSccBody2:
            'Nietrywialny SCC (2 lub więcej modułów) zawsze zawiera co najmniej jeden cykl zależności - ale SCC sam w sobie nie jest jednym cyklem. Może zawierać kilka odrębnych cykli dzielących niektóre z tych samych modułów. Ten raport wyróżnia każdy wykryty SCC jako całość, a nie jedną konkretną ścieżkę cyklu w jego obrębie.',
        eduModalWhyMatterHeading: 'Dlaczego cykle mogą mieć znaczenie?',
        eduModalWhyMatterIntro: 'Cykl zależności może:',
        eduModalWhyMatterItem1:
            'utrudnić rozumowanie o relacjach zależności między tymi modułami',
        eduModalWhyMatterItem2: 'zwiększyć powiązanie między zaangażowanymi modułami',
        eduModalWhyMatterItem3:
            'utrudnić izolowanie lub ponowne wykorzystanie pojedynczego modułu z grupy samodzielnie',
        eduModalWhyMatterItem4:
            'sprawić, że zmiany dotkną większej części SCC niż zmiana w pojedynczym, niecyklicznym module',
        eduModalWhatReportsHeading: 'Co raportuje dep-health-analyzer?',
        eduModalWhatReportsBody:
            'dep-health-analyzer raportuje struktury zależności wykryte w przeskanowanym grafie - nie zna zamierzonej architektury tego projektu.',
        eduModalEmphasis: 'Wykryty cykl lub SCC nie jest automatycznie naruszeniem architektury.',
        eduModalIntentionalBody:
            'Niektóre relacje cykliczne są zamierzone. Tylko osoba znająca zamierzoną architekturę projektu może zdecydować, czy konkretny wykryty cykl warto zmienić.',
        eduModalHowToInvestigateHeading: 'Jak zbadać wykryty SCC',
        eduModalStep1: 'Wybierz moduł będący częścią wykrytego SCC.',
        eduModalStep2: 'Sprawdź inne moduły w tym SCC.',
        eduModalStep3: 'Prześledź kierunki zależności między nimi.',
        eduModalStep4: 'Zrozum, dlaczego te relacje istnieją.',
        eduModalStep5: 'Zdecyduj, czy struktura jest odpowiednia dla zamierzonej architektury projektu.',
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

        layoutLabel: 'Layout:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (arestas retas, sem sobreposição)',
        layoutFlowTB: 'Fluxo / hierárquico (de cima para baixo)',
        layoutFlowOrthogonal: 'Hierárquico (ortogonal, de cima para baixo)',
        layoutFlowOrthogonalLR: 'Hierárquico (ortogonal, da esquerda para a direita)',
        layoutFlowVertical: 'Hierárquico (ortogonal, fluxo vertical)',
        layoutBreadthfirst: 'Busca em largura',
        layoutCose: 'Baseado em forças',
        areaLabel: 'Área:',
        areaAllOption: 'Todas',
        connectionsLabel: 'Conexões:',
        connectionsInternal: 'Apenas internas',
        connectionsExternal: 'Com conexões externas',
        fitGraphButton: 'Ajustar grafo',
        showFullGraphButton: 'Mostrar grafo completo',
        zoomOutLabel: 'Diminuir zoom',
        zoomInLabel: 'Aumentar zoom',
        cycleInfoButton: 'O que são ciclos de dependências?',
        focusRepresentativeNote: 'A mostrar %visible de %n módulos deste SCC - o SCC completo é demasiado grande para ser apresentado de uma só vez.',

        detectedSccsHeading: 'SCCs detectados',
        detectedSccsCaption: '(todo o grafo analisado, não a visualização filtrada atual)',
        noDependencySccsDetected: 'Nenhum SCC de dependências detectado.',
        detectedSccsSummary: 'SCCs detectados: %n &middot; Maior SCC: %largest módulos.',
        moduleAreaHeading: 'Área do módulo',
        moduleAreaCaption: '(a partir da estrutura do projeto)',
        highlightConnectedToggle: 'Destacar módulos conectados',

        hudHelpHoverLine: 'Passe o cursor sobre um módulo para ver as métricas de dependência.',
        hudHelpClickLine: 'Clique em um módulo para <strong>fixar</strong> a dica.',
        hudHelpCaExplanation:
            '&mdash; dependências recebidas<br />Quantos módulos dependem deste módulo.',
        hudHelpCeExplanation:
            '&mdash; dependências enviadas<br />De quantos módulos este módulo depende.',
        instabilityLabel: 'Instabilidade',
        hudHelpInstabilityScale: '0,00 = módulo estável<br />1,00 = módulo muito instável',

        sccSizeLabel: 'Tamanho do SCC',
        hudSelectedEmptyText: 'Clique em um módulo para ver os detalhes.',

        sccContextPartOf:
            'Parte de um componente fortemente conexo (SCC n&ordm;%id) com %n módulos.',
        sccContextContainsCycles: 'Este SCC contém um ou mais ciclos de dependências.',
        sccContextOtherMembers: 'Outros módulos neste SCC:',
        hiddenByFilterNote: '(oculto pelo filtro)',
        hiddenByFocusNote: '(oculto pelo foco)',
        moreCountSuffix: ', +%n mais',
        focusSccButton: 'Focar SCC',
        showDependencyCycleButton: 'Mostrar um ciclo de dependências',
        moduleCountParen: '(%n módulos)',
        moduleCountVisibleParen: '(%visible de %n módulos visíveis)',

        externalAreaLabel: 'Área externa: %name',
        externalAreaAggregatedView:
            'Visualização agregada das conexões entre a área selecionada e %name.',
        externalAreaConnectionsShown: 'Conexões exibidas: %n',
        focusOverflowProxyLabel: '+%n mais',
        focusOverflowPanelBody:
            'A mostrar %visible de %n módulos ligados diretamente a este ciclo; mais %hidden estão agrupados aqui para manter a vista legível.',
        focusNeighborsTruncatedNote:
            'A mostrar os %visible vizinhos diretos mais conectados de %n; o resto está agrupado num nó de resumo.',

        cycleModalTitle: 'Ciclo de dependências',
        cycleModalSubtitle: 'Um ciclo concreto através de %module dentro do SCC n&ordm;%id.',
        cycleModalNote: 'Este SCC pode conter outros ciclos de dependências.',
        showInGraphButton: 'Mostrar no grafo',
        cycleHiddenNoteSingular: '%n módulo está oculto pelo filtro atual.',
        cycleHiddenNotePlural: '%n módulos estão ocultos pelo filtro atual.',
        cycleHiddenNoteSingularFocus: '%n módulo está oculto pelo foco atual.',
        cycleHiddenNotePluralFocus: '%n módulos estão ocultos pelo foco atual.',
        cycleFlowBackTo: 'de volta a',
        cycleModulesHeading: 'Módulos do ciclo',
        closeButton: 'Fechar',

        eduModalTitle: 'Ciclos de dependências',
        eduModalWhatIsCycleHeading: 'O que é um ciclo de dependências?',
        eduModalWhatIsCycleBody:
            'Um ciclo de dependências ocorre quando uma cadeia de relações de dependência acaba voltando a um módulo já alcançado anteriormente na mesma cadeia - por exemplo:',
        eduModalExampleCaption:
            'Aqui, A depende de B, B depende de C, e C depende novamente de A - fechando a cadeia em um ciclo.',
        eduModalWhatIsSccHeading: 'O que é um SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer detecta ciclos encontrando Componentes Fortemente Conexos (SCCs): um SCC é um grupo de módulos onde cada módulo pode alcançar todos os outros módulos do grupo seguindo relações de dependência.',
        eduModalWhatIsSccBody2:
            'Um SCC não trivial (2 ou mais módulos) sempre contém pelo menos um ciclo de dependências - mas um SCC não é em si um único ciclo. Ele pode conter vários ciclos distintos que compartilham alguns dos mesmos módulos. Este relatório destaca cada SCC detectado como um todo, não um caminho de ciclo específico dentro dele.',
        eduModalWhyMatterHeading: 'Por que os ciclos podem importar?',
        eduModalWhyMatterIntro: 'Um ciclo de dependências pode:',
        eduModalWhyMatterItem1:
            'tornar as relações de dependência entre esses módulos mais difíceis de entender',
        eduModalWhyMatterItem2: 'aumentar o acoplamento entre os módulos envolvidos',
        eduModalWhyMatterItem3:
            'dificultar isolar ou reutilizar um único módulo do grupo separadamente',
        eduModalWhyMatterItem4:
            'fazer com que mudanças afetem mais do SCC do que uma mudança em um único módulo não cíclico',
        eduModalWhatReportsHeading: 'O que o dep-health-analyzer relata?',
        eduModalWhatReportsBody:
            'dep-health-analyzer relata as estruturas de dependência que detecta no grafo escaneado - ele não conhece a arquitetura pretendida deste projeto.',
        eduModalEmphasis: 'Um ciclo ou SCC detectado não é automaticamente uma violação arquitetural.',
        eduModalIntentionalBody:
            'Algumas relações cíclicas são intencionais. Somente alguém que conheça a arquitetura pretendida do projeto pode decidir se um ciclo detectado específico vale a pena ser alterado.',
        eduModalHowToInvestigateHeading: 'Como investigar um SCC detectado',
        eduModalStep1: 'Selecione um módulo que faça parte de um SCC detectado.',
        eduModalStep2: 'Inspecione os outros módulos nesse SCC.',
        eduModalStep3: 'Siga as direções de dependência entre eles.',
        eduModalStep4: 'Compreenda por que as relações existem.',
        eduModalStep5: 'Decida se a estrutura é apropriada para a arquitetura pretendida do projeto.',
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

        layoutLabel: 'Раскладка:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (прямые рёбра, без наложений)',
        layoutFlowTB: 'Поток / иерархия (сверху вниз)',
        layoutFlowOrthogonal: 'Иерархия (ортогональная, сверху вниз)',
        layoutFlowOrthogonalLR: 'Иерархия (ортогональная, слева направо)',
        layoutFlowVertical: 'Иерархия (ортогональная, вертикальный поток)',
        layoutBreadthfirst: 'Поиск в ширину',
        layoutCose: 'На основе сил',
        areaLabel: 'Область:',
        areaAllOption: 'Все',
        connectionsLabel: 'Связи:',
        connectionsInternal: 'Только внутренние',
        connectionsExternal: 'С внешними связями',
        fitGraphButton: 'Уместить граф',
        showFullGraphButton: 'Показать весь граф',
        zoomOutLabel: 'Уменьшить',
        zoomInLabel: 'Увеличить',
        cycleInfoButton: 'Что такое циклы зависимостей?',
        focusRepresentativeNote: 'Показано %visible из %n модулей этой SCC - полная SCC слишком велика, чтобы уместиться в одном представлении.',

        detectedSccsHeading: 'Обнаруженные SCC',
        detectedSccsCaption: '(весь проанализированный граф, а не текущий отфильтрованный вид)',
        noDependencySccsDetected: 'SCC с циклами зависимостей не обнаружены.',
        detectedSccsSummary: 'Обнаружено SCC: %n &middot; Наибольший SCC: %largest модулей.',
        moduleAreaHeading: 'Область модуля',
        moduleAreaCaption: '(из структуры проекта)',
        highlightConnectedToggle: 'Подсвечивать связанные модули',

        hudHelpHoverLine: 'Наведите курсор на модуль, чтобы увидеть метрики зависимостей.',
        hudHelpClickLine: 'Нажмите на модуль, чтобы <strong>закрепить</strong> подсказку.',
        hudHelpCaExplanation:
            '&mdash; входящие зависимости<br />Сколько модулей зависят от этого модуля.',
        hudHelpCeExplanation:
            '&mdash; исходящие зависимости<br />От скольких модулей зависит этот модуль.',
        instabilityLabel: 'Нестабильность',
        hudHelpInstabilityScale: '0,00 = стабильный модуль<br />1,00 = крайне нестабильный модуль',

        sccSizeLabel: 'Размер SCC',
        hudSelectedEmptyText: 'Нажмите на модуль, чтобы увидеть детали.',

        sccContextPartOf: 'Часть сильно связной компоненты (SCC #%id) из %n модулей.',
        sccContextContainsCycles: 'Этот SCC содержит один или несколько циклов зависимостей.',
        sccContextOtherMembers: 'Другие модули в этом SCC:',
        hiddenByFilterNote: '(скрыт фильтром)',
        hiddenByFocusNote: '(скрыт фокусом)',
        moreCountSuffix: ', ещё %n',
        focusSccButton: 'Сфокусировать SCC',
        showDependencyCycleButton: 'Показать цикл зависимостей',
        moduleCountParen: '(%n модулей)',
        moduleCountVisibleParen: '(%visible из %n модулей видимы)',

        externalAreaLabel: 'Внешняя область: %name',
        externalAreaAggregatedView:
            'Сводное представление связей между выбранной областью и %name.',
        externalAreaConnectionsShown: 'Показано связей: %n',
        focusOverflowProxyLabel: 'ещё %n',
        focusOverflowPanelBody:
            'Показано %visible из %n модулей, напрямую связанных с этим циклом; ещё %hidden сгруппированы здесь, чтобы вид оставался читаемым.',
        focusNeighborsTruncatedNote:
            'Показаны %visible наиболее связанных из %n прямых соседей - остальные сгруппированы в узел-сводку.',

        cycleModalTitle: 'Цикл зависимостей',
        cycleModalSubtitle: 'Один конкретный цикл через %module внутри SCC #%id.',
        cycleModalNote: 'Этот SCC может содержать другие циклы зависимостей.',
        showInGraphButton: 'Показать в графе',
        cycleHiddenNoteSingular: '%n модуль скрыт текущим фильтром.',
        cycleHiddenNotePlural: '%n модулей скрыто текущим фильтром.',
        cycleHiddenNoteSingularFocus: '%n модуль скрыт текущим фокусом.',
        cycleHiddenNotePluralFocus: '%n модулей скрыто текущим фокусом.',
        cycleFlowBackTo: 'назад к',
        cycleModulesHeading: 'Модули цикла',
        closeButton: 'Закрыть',

        eduModalTitle: 'Циклы зависимостей',
        eduModalWhatIsCycleHeading: 'Что такое цикл зависимостей?',
        eduModalWhatIsCycleBody:
            'Цикл зависимостей возникает, когда цепочка зависимостей в итоге возвращается к модулю, уже пройденному раньше в этой же цепочке - например:',
        eduModalExampleCaption:
            'Здесь A зависит от B, B зависит от C, а C снова зависит от A - замыкая цепочку в цикл.',
        eduModalWhatIsSccHeading: 'Что такое SCC?',
        eduModalWhatIsSccBody1:
            'dep-health-analyzer обнаруживает циклы, находя сильно связные компоненты (SCC): SCC - это группа модулей, где каждый модуль может достичь любого другого модуля группы, следуя зависимостям.',
        eduModalWhatIsSccBody2:
            'Нетривиальный SCC (2 и более модуля) всегда содержит хотя бы один цикл зависимостей - но сам SCC не является одним циклом. Он может содержать несколько разных циклов, использующих некоторые из тех же модулей. Этот отчёт выделяет каждый обнаруженный SCC целиком, а не один конкретный путь цикла внутри него.',
        eduModalWhyMatterHeading: 'Почему циклы могут иметь значение?',
        eduModalWhyMatterIntro: 'Цикл зависимостей может:',
        eduModalWhyMatterItem1: 'усложнить понимание зависимостей между этими модулями',
        eduModalWhyMatterItem2: 'усилить связанность вовлечённых модулей',
        eduModalWhyMatterItem3:
            'затруднить изоляцию или повторное использование одного модуля из группы отдельно',
        eduModalWhyMatterItem4:
            'привести к тому, что изменения затронут бо́льшую часть SCC, чем изменение в одном нециклическом модуле',
        eduModalWhatReportsHeading: 'Что сообщает dep-health-analyzer?',
        eduModalWhatReportsBody:
            'dep-health-analyzer сообщает о структурах зависимостей, обнаруженных в просканированном графе - он не знает предполагаемую архитектуру этого проекта.',
        eduModalEmphasis: 'Обнаруженный цикл или SCC не является автоматически нарушением архитектуры.',
        eduModalIntentionalBody:
            'Некоторые циклические связи являются намеренными. Только тот, кто знает предполагаемую архитектуру проекта, может решить, стоит ли менять конкретный обнаруженный цикл.',
        eduModalHowToInvestigateHeading: 'Как исследовать обнаруженный SCC',
        eduModalStep1: 'Выберите модуль, входящий в обнаруженный SCC.',
        eduModalStep2: 'Изучите другие модули этого SCC.',
        eduModalStep3: 'Проследите направления зависимостей между ними.',
        eduModalStep4: 'Поймите, почему существуют эти связи.',
        eduModalStep5: 'Решите, соответствует ли структура предполагаемой архитектуре проекта.',
    },

    // Right-to-left (see RTL_LANGUAGES above). Arabic's own real
    // singular/dual/plural noun-count agreement is not attempted here -
    // one fixed plural-ish form is used, the same simplification already
    // applied to Polish/Russian above, rather than adding a real
    // pluralization engine for a handful of short technical sentences.
    // "SCC"/"Ca"/"Ce" are kept in Latin script, matching this project's
    // own established convention (every other language keeps them
    // untranslated too) - technical identifiers, not prose.
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

        layoutLabel: 'المخطط:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR (حواف مستقيمة، بلا تداخل)',
        layoutFlowTB: 'تدفق / هرمي (من الأعلى إلى الأسفل)',
        layoutFlowOrthogonal: 'هرمي (متعامد، من الأعلى إلى الأسفل)',
        layoutFlowOrthogonalLR: 'هرمي (متعامد، من اليسار إلى اليمين)',
        layoutFlowVertical: 'هرمي (متعامد، تدفق عمودي)',
        layoutBreadthfirst: 'البحث بالعرض أولاً',
        layoutCose: 'قائم على القوى',
        areaLabel: 'المنطقة:',
        areaAllOption: 'الكل',
        connectionsLabel: 'الاتصالات:',
        connectionsInternal: 'داخلية فقط',
        connectionsExternal: 'مع اتصالات خارجية',
        fitGraphButton: 'ملاءمة الرسم البياني',
        showFullGraphButton: 'عرض الرسم البياني الكامل',
        zoomOutLabel: 'تصغير',
        zoomInLabel: 'تكبير',
        cycleInfoButton: 'ما هي دورات التبعيات؟',
        focusRepresentativeNote: 'يتم عرض %visible من أصل %n وحدة في هذا SCC - هذا الـSCC كبير جدًا بحيث يتعذر عرضه بالكامل دفعة واحدة.',

        detectedSccsHeading: 'مكوّنات SCC المكتشَفة',
        detectedSccsCaption: '(كامل الرسم البياني المحلَّل، وليس العرض المُصفّى الحالي)',
        noDependencySccsDetected: 'لم يتم اكتشاف مكوّنات SCC تحتوي على دورات.',
        detectedSccsSummary: 'مكوّنات SCC المكتشَفة: %n &middot; أكبر SCC: %largest وحدة.',
        moduleAreaHeading: 'منطقة الوحدة',
        moduleAreaCaption: '(من بنية المشروع)',
        highlightConnectedToggle: 'إبراز الوحدات المتصلة',

        hudHelpHoverLine: 'مرّر المؤشر فوق وحدة لرؤية مقاييس التبعية.',
        hudHelpClickLine: 'انقر على وحدة <strong>لتثبيت</strong> التلميح.',
        hudHelpCaExplanation:
            '&mdash; تبعيات واردة<br />كم عدد الوحدات التي تعتمد على هذه الوحدة.',
        hudHelpCeExplanation:
            '&mdash; تبعيات صادرة<br />على كم عدد الوحدات تعتمد هذه الوحدة.',
        instabilityLabel: 'عدم الاستقرار',
        hudHelpInstabilityScale: '0.00 = وحدة مستقرة<br />1.00 = وحدة غير مستقرة جدًا',

        sccSizeLabel: 'حجم SCC',
        hudSelectedEmptyText: 'انقر على وحدة لعرض التفاصيل.',

        sccContextPartOf: 'جزء من مكوّن متصل بقوة (SCC #%id) يضم %n وحدة.',
        sccContextContainsCycles: 'يحتوي هذا SCC على دورة تبعية واحدة أو أكثر.',
        sccContextOtherMembers: 'وحدات أخرى في هذا SCC:',
        hiddenByFilterNote: '(مخفي بواسطة الفلتر)',
        hiddenByFocusNote: '(مخفي بواسطة التركيز)',
        moreCountSuffix: '، +%n أخرى',
        focusSccButton: 'التركيز على SCC',
        showDependencyCycleButton: 'عرض دورة تبعية',
        moduleCountParen: '(%n وحدة)',
        moduleCountVisibleParen: '(%visible من %n وحدة مرئية)',

        externalAreaLabel: 'منطقة خارجية: %name',
        externalAreaAggregatedView: 'عرض مجمّع للاتصالات بين المنطقة المحددة و%name.',
        externalAreaConnectionsShown: 'الاتصالات المعروضة: %n',
        focusOverflowProxyLabel: '+%n أخرى',
        focusOverflowPanelBody:
            'يتم عرض %visible من %n وحدة متصلة مباشرة بهذه الدورة؛ تم تجميع %hidden وحدة إضافية هنا للحفاظ على وضوح العرض.',
        focusNeighborsTruncatedNote:
            'يتم عرض %visible الأكثر ارتباطًا من أصل %n من الجيران المباشرين - وتم تجميع الباقي في عقدة ملخصة.',

        cycleModalTitle: 'دورة تبعية',
        cycleModalSubtitle: 'دورة محددة واحدة عبر %module ضمن SCC #%id.',
        cycleModalNote: 'قد يحتوي هذا SCC على دورات تبعية أخرى.',
        showInGraphButton: 'عرض في الرسم البياني',
        cycleHiddenNoteSingular: 'وحدة واحدة مخفية بواسطة الفلتر الحالي.',
        cycleHiddenNotePlural: '%n وحدة مخفية بواسطة الفلتر الحالي.',
        cycleHiddenNoteSingularFocus: 'وحدة واحدة مخفية بواسطة التركيز الحالي.',
        cycleHiddenNotePluralFocus: '%n وحدة مخفية بواسطة التركيز الحالي.',
        cycleFlowBackTo: 'العودة إلى',
        cycleModulesHeading: 'وحدات الدورة',
        closeButton: 'إغلاق',

        eduModalTitle: 'دورات التبعيات',
        eduModalWhatIsCycleHeading: 'ما هي دورة التبعية؟',
        eduModalWhatIsCycleBody:
            'تحدث دورة التبعية عندما تؤدي سلسلة من علاقات التبعية في النهاية إلى العودة إلى وحدة تم الوصول إليها بالفعل في وقت سابق من نفس السلسلة - على سبيل المثال:',
        eduModalExampleCaption:
            'هنا، تعتمد A على B، وتعتمد B على C، وتعتمد C مرة أخرى على A - مما يغلق السلسلة في دورة.',
        eduModalWhatIsSccHeading: 'ما هو SCC؟',
        eduModalWhatIsSccBody1:
            'يكتشف dep-health-analyzer الدورات من خلال إيجاد المكوّنات المتصلة بقوة (SCC): SCC هو مجموعة من الوحدات حيث يمكن لكل وحدة الوصول إلى كل وحدة أخرى في المجموعة باتباع علاقات التبعية.',
        eduModalWhatIsSccBody2:
            'يحتوي أي SCC غير بسيط (وحدتان أو أكثر) دائمًا على دورة تبعية واحدة على الأقل - لكن SCC نفسه ليس دورة واحدة. يمكن أن يحتوي على عدة دورات متمايزة تشترك في بعض الوحدات نفسها. يبرز هذا التقرير كل SCC مكتشَف ككل، وليس مسار دورة واحدًا محددًا داخله.',
        eduModalWhyMatterHeading: 'لماذا قد تكون الدورات مهمة؟',
        eduModalWhyMatterIntro: 'قد تؤدي دورة التبعية إلى:',
        eduModalWhyMatterItem1: 'جعل علاقات التبعية بين هذه الوحدات أصعب في الفهم',
        eduModalWhyMatterItem2: 'زيادة الاقتران بين الوحدات المعنية',
        eduModalWhyMatterItem3: 'زيادة صعوبة عزل أو إعادة استخدام وحدة واحدة من المجموعة بمفردها',
        eduModalWhyMatterItem4:
            'جعل التغييرات تمس جزءًا أكبر من SCC مقارنة بتغيير في وحدة واحدة غير دورية',
        eduModalWhatReportsHeading: 'بماذا يفيد dep-health-analyzer؟',
        eduModalWhatReportsBody:
            'يبلّغ dep-health-analyzer عن هياكل التبعية التي يكتشفها في الرسم البياني الممسوح - وهو لا يعرف البنية المعمارية المقصودة لهذا المشروع.',
        eduModalEmphasis: 'الدورة أو SCC المكتشَفة ليست بالضرورة انتهاكًا معماريًا.',
        eduModalIntentionalBody:
            'بعض العلاقات الدورية مقصودة. فقط من يعرف البنية المعمارية المقصودة للمشروع يمكنه تحديد ما إذا كانت دورة مكتشَفة معينة تستحق التغيير.',
        eduModalHowToInvestigateHeading: 'كيفية دراسة SCC مكتشَف',
        eduModalStep1: 'اختر وحدة تُعد جزءًا من SCC مكتشَف.',
        eduModalStep2: 'افحص الوحدات الأخرى في ذلك SCC.',
        eduModalStep3: 'تتبّع اتجاهات التبعية بينها.',
        eduModalStep4: 'افهم سبب وجود هذه العلاقات.',
        eduModalStep5: 'قرّر ما إذا كانت البنية مناسبة للبنية المعمارية المقصودة للمشروع.',
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

        layoutLabel: 'レイアウト:',
        layoutDagreLR: 'Dagre LR',
        layoutDagreTB: 'Dagre TB',
        layoutDagreLRClean: 'Dagre LR（直線エッジ、重なりなし）',
        layoutFlowTB: 'フロー / 階層（上から下）',
        layoutFlowOrthogonal: '階層（直交、上から下）',
        layoutFlowOrthogonalLR: '階層（直交、左から右）',
        layoutFlowVertical: '階層（直交、垂直フロー）',
        layoutBreadthfirst: '幅優先探索',
        layoutCose: '力学モデル',
        areaLabel: 'エリア:',
        areaAllOption: 'すべて',
        connectionsLabel: '接続:',
        connectionsInternal: '内部のみ',
        connectionsExternal: '外部接続を含む',
        fitGraphButton: 'グラフを合わせる',
        showFullGraphButton: 'グラフ全体を表示',
        zoomOutLabel: '縮小',
        zoomInLabel: '拡大',
        cycleInfoButton: '依存関係の循環とは？',
        focusRepresentativeNote: 'この SCC の %n モジュール中 %visible 件を表示しています - SCC 全体は一度に表示するには大きすぎます。',

        detectedSccsHeading: '検出されたSCC',
        detectedSccsCaption: '（現在のフィルター表示ではなく、分析されたグラフ全体）',
        noDependencySccsDetected: '循環を含むSCCは検出されませんでした。',
        detectedSccsSummary: '検出されたSCC: %n &middot; 最大のSCC: %largest モジュール。',
        moduleAreaHeading: 'モジュールエリア',
        moduleAreaCaption: '（プロジェクト構造に基づく）',
        highlightConnectedToggle: '接続されたモジュールを強調表示',

        hudHelpHoverLine: 'モジュールにカーソルを合わせると依存関係の指標が表示されます。',
        hudHelpClickLine: 'モジュールをクリックするとツールチップを<strong>固定</strong>できます。',
        hudHelpCaExplanation:
            '&mdash; 受信依存関係<br />このモジュールに依存しているモジュールの数。',
        hudHelpCeExplanation:
            '&mdash; 送信依存関係<br />このモジュールが依存しているモジュールの数。',
        instabilityLabel: '不安定度',
        hudHelpInstabilityScale: '0.00 = 安定したモジュール<br />1.00 = 非常に不安定なモジュール',

        sccSizeLabel: 'SCCサイズ',
        hudSelectedEmptyText: 'モジュールをクリックすると詳細が表示されます。',

        sccContextPartOf: '%n モジュールから成る強連結成分（SCC #%id）の一部です。',
        sccContextContainsCycles: 'このSCCには1つ以上の依存関係の循環が含まれています。',
        sccContextOtherMembers: 'このSCC内の他のモジュール:',
        hiddenByFilterNote: '（フィルターにより非表示）',
        hiddenByFocusNote: '（フォーカスにより非表示）',
        moreCountSuffix: '、他%n件',
        focusSccButton: 'SCCにフォーカス',
        showDependencyCycleButton: '依存関係の循環を表示',
        moduleCountParen: '（%n モジュール）',
        moduleCountVisibleParen: '（%n モジュール中%visible件が表示中）',

        externalAreaLabel: '外部エリア: %name',
        externalAreaAggregatedView: '選択したエリアと%nameとの間の接続の集計ビュー。',
        externalAreaConnectionsShown: '表示中の接続数: %n',
        focusOverflowProxyLabel: '他%n件',
        focusOverflowPanelBody:
            'このサイクルに直接接続されている%nモジュール中%visible件を表示しています。残りの%hidden件はここにまとめられ、見やすさを保っています。',
        focusNeighborsTruncatedNote:
            '直接の隣接モジュール%n件中、最も関連の強い%visible件を表示しています。残りは要約ノードにまとめられています。',

        cycleModalTitle: '依存関係の循環',
        cycleModalSubtitle: 'SCC #%id内の%moduleを通る具体的な循環。',
        cycleModalNote: 'このSCCには他の依存関係の循環が含まれている場合があります。',
        showInGraphButton: 'グラフで表示',
        cycleHiddenNoteSingular: '%n件のモジュールが現在のフィルターにより非表示です。',
        cycleHiddenNotePlural: '%n件のモジュールが現在のフィルターにより非表示です。',
        cycleHiddenNoteSingularFocus: '%n件のモジュールが現在のフォーカスにより非表示です。',
        cycleHiddenNotePluralFocus: '%n件のモジュールが現在のフォーカスにより非表示です。',
        cycleFlowBackTo: '戻る先:',
        cycleModulesHeading: '循環のモジュール',
        closeButton: '閉じる',

        eduModalTitle: '依存関係の循環',
        eduModalWhatIsCycleHeading: '依存関係の循環とは？',
        eduModalWhatIsCycleBody:
            '依存関係の循環は、依存関係の連鎖が最終的に同じ連鎖内で以前に到達したモジュールに戻るときに発生します。例:',
        eduModalExampleCaption:
            'ここでは、AはBに依存し、BはCに依存し、Cは再びAに依存しています - これにより連鎖が循環として閉じます。',
        eduModalWhatIsSccHeading: 'SCCとは？',
        eduModalWhatIsSccBody1:
            'dep-health-analyzerは強連結成分（SCC）を見つけることで循環を検出します。SCCとは、グループ内のすべてのモジュールが依存関係をたどってグループ内の他のすべてのモジュールに到達できるモジュールの集まりです。',
        eduModalWhatIsSccBody2:
            '自明でないSCC（2つ以上のモジュール）には常に少なくとも1つの依存関係の循環が含まれますが、SCC自体が1つの循環というわけではありません。同じモジュールの一部を共有する複数の異なる循環を含むことがあります。このレポートは検出された各SCCを全体として強調表示し、その中の特定の循環経路を示すものではありません。',
        eduModalWhyMatterHeading: 'なぜ循環が重要な場合があるのか？',
        eduModalWhyMatterIntro: '依存関係の循環は次のような影響を与える可能性があります:',
        eduModalWhyMatterItem1: 'それらのモジュール間の依存関係を理解しにくくする',
        eduModalWhyMatterItem2: '関連するモジュール間の結合を強める',
        eduModalWhyMatterItem3: 'グループから単一のモジュールを単独で分離または再利用することを難しくする',
        eduModalWhyMatterItem4:
            '単一の非循環モジュールへの変更よりも、変更がSCCのより多くの部分に影響を与えるようにする',
        eduModalWhatReportsHeading: 'dep-health-analyzerは何を報告するのか？',
        eduModalWhatReportsBody:
            'dep-health-analyzerはスキャンしたグラフで検出した依存関係の構造を報告します - このプロジェクトの意図されたアーキテクチャは把握していません。',
        eduModalEmphasis: '検出された循環やSCCは、自動的にアーキテクチャ違反となるわけではありません。',
        eduModalIntentionalBody:
            '一部の循環的な関係は意図的なものです。特定の検出された循環を変更する価値があるかどうかは、プロジェクトの意図されたアーキテクチャを知る人だけが判断できます。',
        eduModalHowToInvestigateHeading: '検出されたSCCを調査する方法',
        eduModalStep1: '検出されたSCCの一部であるモジュールを選択します。',
        eduModalStep2: 'そのSCC内の他のモジュールを確認します。',
        eduModalStep3: 'それらの間の依存関係の方向をたどります。',
        eduModalStep4: 'なぜその関係が存在するのかを理解します。',
        eduModalStep5: 'その構造がプロジェクトの意図されたアーキテクチャに適しているかを判断します。',
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
