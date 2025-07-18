module.exports = {
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.spec.ts", "!src/**/*.d.ts", "!test/**/*", "!src/providers/**/*", "!src/index.ts"],
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "./tsconfig.json" }]
  },
  transformIgnorePatterns: ["../../node_modules/(?!(@kubernetes/client-node)/)"],
  rootDir: ".",
  moduleNameMapper: {
    "^@src(.*)$": "<rootDir>/src/$1",
    "^@test/(.*)$": "<rootDir>/test/$1"
  },
  setupFiles: ["./test/setup.ts"],
  testMatch: ["<rootDir>/src/**/*.spec.ts"]
};
