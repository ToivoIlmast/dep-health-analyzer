const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

module.exports = [
    {
        ignores: [
            '.dep-health-analyzer',
            '.tmp-dep-health',
            'dist/**',
            'coverage/**',
            'node_modules/**',
            'src/**/__fixtures__/**',
            '*.config.cjs',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
];
