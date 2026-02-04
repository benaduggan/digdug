import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
    // Global ignores must be in a separate config object
    {
        ignores: ['node_modules/**', 'dist/**', '*.config.js'],
    },
    // Apply settings to all Javascript files
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off', // Set to "warn" for production-ready apps
            'prefer-const': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
];
