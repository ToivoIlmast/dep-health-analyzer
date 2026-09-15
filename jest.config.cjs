module.exports = {
    testEnvironment: 'node',
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
