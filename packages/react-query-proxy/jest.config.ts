import type { Config } from "jest";

export default {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/**/*.spec.ts"],
  verbose: true
} satisfies Config;
