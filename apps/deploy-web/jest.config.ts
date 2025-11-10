import type { Config } from "@jest/types";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./"
});

const common = {
  moduleNameMapper: {
    "^@src(.*)$": "<rootDir>/src/$1",
    "^@tests(.*)$": "<rootDir>/tests/$1"
  },
  transform: {
    "\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }] as Config.TransformerConfig
  }
} satisfies Config.InitialProjectOptions;

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
    "^next-navigation-guard$": "<rootDir>/../../node_modules/next-navigation-guard/dist/index.js"
  },
  setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"]
});

export default async (): Promise<Config.InitialOptions> => {
  return {
    rootDir: ".",
    collectCoverageFrom: ["<rootDir>/src/**/*.{js,ts,tsx}"],
    projects: [
      {
        coveragePathIgnorePatterns: ["/lib/nextjs/", "/tests/"],
        displayName: "unit",
        ...(await getConfig())
      },
      {
        coveragePathIgnorePatterns: ["/lib/nextjs/setup-node-tests\\.ts$", "/tests/", "\\.spec\\.tsx?$"],
        displayName: "unit-node",
        testEnvironment: "node",
        testMatch: ["<rootDir>/src/lib/nextjs/**/*.spec.{tsx,ts}"],
        ...common,
        moduleNameMapper: {
          ...common.moduleNameMapper
        },
        setupFilesAfterEnv: ["<rootDir>/src/lib/nextjs/setup-node-tests.ts"]
      }
    ]
  };
};
