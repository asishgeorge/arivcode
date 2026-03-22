import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ['dist/', 'node_modules/'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'sonarjs/pseudo-random': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'sonarjs/publicly-writable-directories': 'off',
    },
  },
];
