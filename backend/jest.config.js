/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/unit_tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', { module: { type: 'commonjs' } }],
  },
  reporters: ['default', 'jest-junit'],
};