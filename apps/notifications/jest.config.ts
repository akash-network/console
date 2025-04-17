const MAP_ALIASES = {
  '^@src(.*)$': '<rootDir>/src/$1',
  '^@test/(.*)$': '<rootDir>/test/$1',
};

const common = {
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  rootDir: '.',
  moduleNameMapper: {
    ...MAP_ALIASES,
  },
};

export default {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/console.ts',
    '!src/test/**/*',
    '!src/**/index.ts',
  ],
  projects: [
    {
      displayName: 'unit',
      ...common,
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      displayName: 'functional',
      ...common,
      testMatch: ['<rootDir>/test/functional/**/*.spec.ts'],
      setupFilesAfterEnv: ['./test/setup-functional-tests.ts'],
      setupFiles: ['./test/setup-functional-env.ts'],
    },
  ],
};
