module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.ts$': ['ts-jest', { useESM: true }],
    },

    testPathIgnorePatterns: ['/dist/'],
};
