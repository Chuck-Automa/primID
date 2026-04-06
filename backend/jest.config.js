module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  moduleNameMapper: {
    // Redirect all Prisma singleton imports to the shared mock.
    // Covers both '../db/prisma' (from shared/ modules) and '../../shared/db/prisma'
    // (from modules/ controllers) and '../../src/shared/db/prisma' (from test files).
    '.+/db/prisma(\\.js)?$': '<rootDir>/tests/__mocks__/prisma.js',
    // Redirect crypto.util to a lightweight mock that skips real AES/HMAC ops
    // and libphonenumber-js validation so tests don't need real env keys.
    '.+/utils/crypto\\.util(\\.js)?$': '<rootDir>/tests/__mocks__/crypto.util.js',
  },
  setupFiles: ['<rootDir>/tests/setup.js'],
  clearMocks: true,
  testTimeout: 10000,
};
