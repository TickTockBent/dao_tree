/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: 'vue-eslint-parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', parser: '@typescript-eslint/parser' },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'js', 'css', 'legacy-index.html', '*.cjs'],
  rules: {
    // §11 no-numeric-literals rule, scoped to engine code (data tables exempt)
    'no-magic-numbers': ['off'],
    '@typescript-eslint/no-magic-numbers': [
      'error',
      {
        ignore: [0, 1, -1, 2, 100],
        ignoreEnums: true,
        ignoreDefaultValues: true,
        ignoreNumericLiteralTypes: true,
        ignoreReadonlyClassProperties: true,
        ignoreTypeIndexes: true,
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'vue/multi-word-component-names': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/html-self-closing': 'off',
  },
  overrides: [
    {
      // Data tables are where numbers live — exempt from §11
      files: ['src/data/**/*.ts'],
      rules: {
        '@typescript-eslint/no-magic-numbers': 'off',
      },
    },
    {
      // Tests may use arbitrary numbers
      files: ['src/**/*.test.ts', 'src/sim/**/*.ts'],
      rules: {
        '@typescript-eslint/no-magic-numbers': 'off',
      },
    },
  ],
}
