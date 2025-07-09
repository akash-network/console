import type { Config } from "@jest/types";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./"
});

const common: Config.InitialOptions = {
  moduleNameMapper: {
    "^@src(.*)$": "<rootDir>/src/$1",
    "^@tests(.*)$": "<rootDir>/tests/$1"
  }
};

const styleMockPath = "<rootDir>/../../node_modules/next/dist/build/jest/__mocks__/styleMock.js";
const getConfig = createJestConfig({
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/src/**/*.spec.{tsx,ts}"],
  transform: {
    "\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
  },
  moduleNameMapper: {
    ...common.moduleNameMapper,
    "@interchain-ui\\/react\\/styles$": styleMockPath,
    "@interchain-ui\\/react\\/globalStyles$": styleMockPath,
    "^next-navigation-guard$": "<rootDir>/../../node_modules/next-navigation-guard/dist/index.js"
  },
  setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"]
});

export default async (): Promise<Config.InitialOptions> => {
  const unitTestsConfig = await getConfig();

  return {
    collectCoverageFrom: ["<rootDir>/src/**/*.{js,ts,tsx}"],
    testTimeout: 10_000, // need higher value for functional tests
    projects: [
      {
        ...unitTestsConfig,
        displayName: "unit"
      },
      {
        transform: {
          "\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
        },
        moduleNameMapper: {
          ...common.moduleNameMapper
        },
        testMatch: ["<rootDir>/tests/functional/**/*.spec.ts"],
        testEnvironment: "setup-polly-jest/jest-environment-node",
        displayName: "functional",
        setupFilesAfterEnv: ["<rootDir>/tests/functional/setup.ts"]
      }
    ]
  };
};
