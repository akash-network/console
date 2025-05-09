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
    '!src/test/**/*',
    '!src/**/index.ts',
    '!src/**/*.module.ts',
    '!src/**/*.config.ts',
    '!src/modules/notifications/providers/novu.provider.ts',
  ],
  projects: [
    {
      displayName: 'unit',
      ...common,
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      setupFiles: ['./test/setup-env.ts'],
    },
    {
      displayName: 'functional',
      ...common,
      testMatch: ['<rootDir>/test/functional/**/*.spec.ts'],
      setupFilesAfterEnv: ['./test/setup-functional-tests.ts'],
      setupFiles: ['./test/setup-env.ts'],
    },
  ],
};
