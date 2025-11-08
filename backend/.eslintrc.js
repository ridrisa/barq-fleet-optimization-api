module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'prettier'
  ],
  plugins: ['prettier', 'security', 'node'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Code quality rules
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',

    // Complexity rules
    'complexity': ['warn', 10],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
    'max-nested-callbacks': ['warn', 3],
    'max-params': ['warn', 4],

    // Best practices
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-return-await': 'warn',
    'require-await': 'warn',
    'no-magic-numbers': ['warn', {
      ignore: [0, 1, -1, 2],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
      enforceConst: true
    }],

    // Node.js specific
    'node/no-unsupported-features/es-syntax': 'off',
    'node/no-missing-import': 'off',
    'node/no-unpublished-require': 'off',

    // Security
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',

    // Prettier integration
    'prettier/prettier': ['error', {
      singleQuote: true,
      semi: true,
      trailingComma: 'es5',
      printWidth: 100,
      tabWidth: 2,
      arrowParens: 'always'
    }]
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      rules: {
        'no-magic-numbers': 'off',
        'max-lines-per-function': 'off'
      }
    }
  ]
};
