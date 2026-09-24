/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/bot/**',
    '!src/app.ts'
  ],
  setupFiles: ['<rootDir>/src/tests/setup.ts'],
  moduleNameMapper: {
    '^@prisma/client$': require.resolve('@prisma/client'),
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};