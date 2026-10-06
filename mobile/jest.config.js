module.exports = {
  preset: 'jest-expo',
  // Full-screen UI tests take longer than the 5 s default on shared CI runners (Samagri and reminder suites timed out there).
  testTimeout: 15000,
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
