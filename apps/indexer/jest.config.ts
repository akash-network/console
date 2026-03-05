import type { Config } from "jest";

const MAP_ALIASES: Record<string, string> = {
  "^@src(.*)$": "<rootDir>/src/$1",
  "^@test/(.*)$": "<rootDir>/test/$1"
};

const common = {
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "./test/tsconfig.json" }]
  },
  rootDir: ".",
  moduleNameMapper: {
    ...MAP_ALIASES
  }
} satisfies Config;

const config: Config = {
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.spec.ts", "!src/**/*.d.ts", "!src/main.ts", "!src/console.ts", "!src/test/**/*", "!src/**/index.ts"],
  projects: [
    {
      displayName: "unit",
      ...common,
      testMatch: ["<rootDir>/src/**/*.spec.ts"]
    }
  ]
};

export default config;
