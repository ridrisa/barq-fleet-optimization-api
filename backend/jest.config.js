module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db/**',
    '!src/**/*.test.js',
    '!src/demo/**',
    '!src/app.js' // Entry point, tested via integration tests
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'BARQ Fleet Management - Test Report',
      outputPath: 'test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
      sort: 'status'
    }]
  ],
  moduleDirectories: ['node_modules', 'src'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  verbose: true
};
