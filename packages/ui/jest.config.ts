import type { Config } from "jest";

const config: Config = {
  rootDir: ".",
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/**/*.spec.tsx"],
  setupFilesAfterEnv: ["<rootDir>/tests-setup.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy"
  },
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts", "!**/node_modules/**"],
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: ["/node_modules/", "/coverage/", "reportWebVitals.ts", "setupTests.ts"]
};

export default config;
