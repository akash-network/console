const MAP_ALIASES = {
  '^@src(.*)$': "<rootDir>/src$1",
  '^@shared/(.*)$': '<rootDir>/../shared/$1',
};
const MAP_TO_SAME_SEQUELIZE_PACKAGE = {
  '^sequelize(.*)$': '<rootDir>/node_modules/sequelize$1',
}

const common = {
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  rootDir: '.',
  moduleNameMapper: {
    ...MAP_ALIASES,
    ...MAP_TO_SAME_SEQUELIZE_PACKAGE,
  },
  setupFiles: ['./test/setup.ts'],
};

module.exports = {
  collectCoverageFrom: ['./src/**/*.{js,ts}'],
  projects: [
    {
      displayName: 'unit',
      ...common,
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      setupFilesAfterEnv: ['./test/setup-unit-tests.ts'],
    },
    {
      displayName: 'functional',
      ...common,
      testMatch: ['<rootDir>/test/functional/**/*.spec.ts'],
      setupFilesAfterEnv: ['./test/setup-functional-tests.ts'],
    },
  ],
};
