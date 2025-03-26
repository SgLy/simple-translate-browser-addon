// @ts-check
const js = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const typescriptEslint = require('typescript-eslint');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');

/** @type {Record<'typescript' | 'errors' | 'warnings', Readonly<import('eslint').Linter.RulesRecord>>} */
// @ts-expect-error
const importPluginFlatConfigs = importPlugin.flatConfigs;

/** @type {import('eslint').Linter.Config[]} */
module.exports = typescriptEslint.config(
  importPluginFlatConfigs.errors,
  importPluginFlatConfigs.warnings,
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
    },
    rules: {
      'import/first': 'error',
      'import/order': 'error',
      'import/named': 'off',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-named-as-default': 'error',
      'import/no-cycle': 'error',
      'import/no-unused-modules': 'error',
      'import/no-deprecated': 'error',
      'import/no-duplicates': 'error',
      'no-duplicate-imports': 'off',
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
    },
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    extends: [
      typescriptEslint.configs.eslintRecommended,
      typescriptEslint.configs.recommended,
      importPluginFlatConfigs.typescript,
    ],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
      ],
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
