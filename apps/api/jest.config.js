const MAP_ALIASES = {
  "^@src(.*)$": "<rootDir>/src/$1",
  "^@test/(.*)$": "<rootDir>/test/$1"
};

const common = {
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "./tsconfig.json" }]
  },
  rootDir: ".",
  moduleNameMapper: {
    ...MAP_ALIASES
  },
  setupFiles: ["./test/setup.ts"]
};

module.exports = {
  collectCoverageFrom: ["./src/**/*.{js,ts}"],
  projects: [
    {
      displayName: "unit",
      ...common,
      testMatch: ["<rootDir>/src/**/*.spec.ts"],
      setupFilesAfterEnv: ["./test/setup-unit-tests.ts"],
      setupFiles: ["./test/setup-unit-env.ts"]
    },
    {
      displayName: "functional",
      ...common,
      testMatch: ["<rootDir>/test/functional/**/*.spec.ts"],
      setupFilesAfterEnv: ["./test/setup-functional-tests.ts"],
      setupFiles: ["./test/setup-functional-env.ts"]
    }
  ]
};
