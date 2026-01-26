const { localConfig } = require("./test/services/local.config");
const MAP_ALIASES = {
  "^@src(.*)$": "<rootDir>/src/$1",
  "^@test/(.*)$": "<rootDir>/test/$1"
};

const common = {
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "./test/tsconfig.json" }]
  },
  transformIgnorePatterns: ["node_modules/(?!(@octokit|universal-user-agent|before-after-hook)/)"],
  rootDir: ".",
  moduleNameMapper: {
    ...MAP_ALIASES
  }
};

/** @type {import('jest').Config} */
const config = {
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.spec.ts", "!src/**/*.d.ts", "!src/main.ts", "!src/console.ts", "!src/test/**/*", "!src/**/index.ts"],
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
      setupFiles: ["./test/setup-functional-env.ts"],
      globalSetup: "./test/setup-global-functional.ts",
      testEnvironment: "./test/custom-jest-environment.ts"
    },
    {
      displayName: "e2e",
      ...common,
      testMatch: ["<rootDir>/test/e2e/**/*.spec.ts"]
    }
  ]
};

if (localConfig.FUNDING_WALLET_MNEMONIC) {
  config.maxWorkers = 1;
}

module.exports = config;
