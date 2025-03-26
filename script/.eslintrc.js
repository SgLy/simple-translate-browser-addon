/** @type import('eslint').Linter.Config */
module.exports = {
  env: {
    node: true,
    browser: false,
  },
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:prettier/recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier',
        'plugin:import/typescript',
      ],
      plugins: ['@typescript-eslint', 'import'],
    },
  ],
};
