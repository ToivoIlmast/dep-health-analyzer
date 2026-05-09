const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

module.exports = [
    {
        ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'src/fixtures/**', '*.config.cjs'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
];
