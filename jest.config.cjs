module.exports = {
    testEnvironment: 'node',
    // v8, not Jest's default babel-plugin-istanbul-based provider: the
    // default provider works by literally rewriting source files to inject
    // `cov_xxx()` counter calls into their compiled text - harmless for
    // every other file, but template.ts's client script embeds a handful
    // of real, already-unit-tested functions (graphOverlapResolution.ts,
    // focusNeighbourSelection.ts) verbatim via `.toString()` (see
    // template.ts's own comments on why - so the report's client-side
    // logic and its Jest-tested source can never drift apart). Under the
    // istanbul provider, `.toString()` on those (now-instrumented)
    // functions returns their coverage-counter calls too, referencing a
    // module-scoped `cov_xxx` variable that doesn't exist wherever that
    // embedded string later actually runs (a real browser, or - new in
    // this audit's own P1-3/4/5 behavioral tests -
    // template.behavior.test.ts's real jsdom/cytoscape execution of the
    // literal generated script) - a `ReferenceError` the moment that
    // embedded code path executes. V8's coverage provider tracks coverage
    // via the engine's own bytecode instrumentation instead of rewriting
    // source text, so `.toString()` stays byte-for-byte what the function
    // was actually written as, with no change to what's measured or
    // reported.
    coverageProvider: 'v8',
    transform: {
        '^.+\\.ts$': ['ts-jest', { useESM: true }],
    },
    moduleNameMapper: {
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
        '^@features/(.*)$': '<rootDir>/src/features/$1',
        '^@app/(.*)$': '<rootDir>/src/app/$1',
    },
    testPathIgnorePatterns: ['/dist/', '/test-projects/', '/test-projects-scale/'],
    // test-projects/ holds the external validation corpus - 30+ generated,
    // gitignored fixture repos, several sharing package names like
    // "@corpus/shared" across different monorepo fixtures. Without this,
    // Jest's haste module map scans them anyway (testPathIgnorePatterns only
    // controls which files run AS tests, not which files Jest indexes as
    // modules), producing "Haste module naming collision" warnings, and any
    // *.test.ts a fixture happens to contain would run as part of this
    // repository's own test suite. test-projects-scale/ is the same kind of
    // corpus (see test-projects-scale/README.md) at a much larger module
    // count, so it needs the exact same exclusion for the exact same reason -
    // plus Jest would otherwise try to index thousands of extra files on
    // every run.
    modulePathIgnorePatterns: ['<rootDir>/test-projects/', '<rootDir>/test-projects-scale/'],
    watchPathIgnorePatterns: ['<rootDir>/test-projects/', '<rootDir>/test-projects-scale/'],
};
