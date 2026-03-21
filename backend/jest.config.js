module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  // Run test suites sequentially to avoid DB conflicts
  maxWorkers: 1,
};
