import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./"
});

const styleMockPath = "<rootDir>/../../node_modules/next/dist/build/jest/__mocks__/styleMock.js";
const getConfig = createJestConfig({
  testEnvironment: "jsdom",
  collectCoverageFrom: ["<rootDir>/src/**/*.{js,ts,tsx}"],
  testMatch: ["<rootDir>/tests/unit/**/*.spec.{tsx,ts}"],
  transform: {
    "\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
  },
  moduleNameMapper: {
    "^@src(.*)$": "<rootDir>/src/$1",
    "@interchain-ui\\/react\\/styles$": styleMockPath,
    "@interchain-ui\\/react\\/globalStyles$": styleMockPath
  },
  setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"]
});

export default getConfig;
