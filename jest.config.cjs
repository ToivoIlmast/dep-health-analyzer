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
    testPathIgnorePatterns: ['/dist/'],
};
