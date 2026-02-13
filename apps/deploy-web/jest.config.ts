import type { Config } from "@jest/types";
import { createRequire } from "module";
import nextJest from "next/jest.js";
import path from "path";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./"
});
const require = createRequire(import.meta.url);

const common = {
  moduleNameMapper: {
    "^@src(.*)$": "<rootDir>/src/$1",
    "^@tests(.*)$": "<rootDir>/tests/$1",
    // see ./src/lib/auth0/setSession/setSession.ts for more details
    "^@auth0/nextjs-auth0/session$": path.join(require.resolve("@auth0/nextjs-auth0"), "..", "session", "index.js"),
    "^@auth0/nextjs-auth0/update-session$": path.join(require.resolve("@auth0/nextjs-auth0"), "..", "session", "update-session.js")
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
  testPathIgnorePatterns: ["/lib/nextjs/", "/lib/auth0/"],
  moduleNameMapper: {
    ...common.moduleNameMapper,
    "@interchain-ui\\/react\\/styles$": styleMockPath,
    "@interchain-ui\\/react\\/globalStyles$": styleMockPath,
    "^next-navigation-guard$": "<rootDir>/../../node_modules/next-navigation-guard/dist/index.js",
    "^monaco-yaml$": styleMockPath
  },
  setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"]
});

export default async (): Promise<Config.InitialOptions> => {
  return {
    rootDir: ".",
    collectCoverageFrom: ["<rootDir>/src/**/*.{js,ts,tsx}"],
    projects: [
      {
        coveragePathIgnorePatterns: ["/lib/nextjs/", "/tests/", "/lib/auth0/"],
        displayName: "unit",
        ...(await getConfig())
      },
      {
        coveragePathIgnorePatterns: ["/lib/nextjs/setup-node-tests\\.ts$", "/tests/", "\\.spec\\.tsx?$"],
        displayName: "unit-node",
        testEnvironment: "node",
        testMatch: ["<rootDir>/src/lib/{nextjs,auth0}/**/*.spec.{tsx,ts}"],
        ...common,
        moduleNameMapper: {
          ...common.moduleNameMapper
        },
        transformIgnorePatterns: [
          // see ./src/lib/auth0/setSession/setSession.ts for more details
          "node_modules/(?!@auth0/nextjs-auth0)"
        ],
        transform: {
          ...common.transform,
          // see ./src/lib/auth0/setSession/setSession.ts for more details
          "@auth0/nextjs-auth0/[\\w\\/.]+\\.js$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.build.json" }] as Config.TransformerConfig
        },
        setupFilesAfterEnv: ["<rootDir>/src/lib/nextjs/setup-node-tests.ts"]
      }
    ]
  };
};
