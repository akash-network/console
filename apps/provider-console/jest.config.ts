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
  },
  transform: {
    "\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
  }
};

const styleMockPath = "<rootDir>/../../node_modules/next/dist/build/jest/__mocks__/styleMock.js";
const getConfig = createJestConfig({
  ...common,
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/src/**/*.spec.{tsx,ts}"],
  testPathIgnorePatterns: ["/lib/nextjs/"],
  moduleNameMapper: {
    ...common.moduleNameMapper,
    "@interchain-ui\\/react\\/styles$": styleMockPath,
    "@interchain-ui\\/react\\/globalStyles$": styleMockPath,
    "^next-navigation-guard$": "<rootDir>/../../node_modules/next-navigation-guard/dist/index.js",
    // Map UI package internal imports to the actual utils
    "^@akashnetwork/ui/utils$": "<rootDir>/../../packages/ui/utils/index.ts"
  },
  setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"]
});

const config = async (): Promise<Config.InitialOptions> => {
  return {
    rootDir: ".",
    projects: [
      {
        collectCoverageFrom: ["<rootDir>/src/**/*.{js,ts,tsx}"],
        coveragePathIgnorePatterns: ["/tests/"],
        displayName: "unit",
        ...(await getConfig())
      }
    ]
  };
};

export default config;
