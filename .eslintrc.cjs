module.exports = {
  root: true,
  // Uses import attributes, which ESLint 8's parser can't read. See the file.
  ignorePatterns: ['worker/version.mjs'],
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ['eslint:recommended', 'plugin:vue/recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'vue/attributes-order': 'off',
    'vue/html-indent': 'off',
    'vue/html-self-closing': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-reserved-keys': 'off',
    'vue/no-v-html': 'off',
    'vue/order-in-components': 'off',
    'vue/singleline-html-element-content-newline': 'off'
  },
  overrides: [
    {
      files: ['installer/install-progress.js'],
      globals: { ObjC: 'readonly', $: 'readonly' },
      rules: { 'no-constant-condition': 'off' }
    },
    {
      files: ['src/utils/api/mcapi.js'],
      globals: { mcapi: 'readonly' }
    }
  ]
}
