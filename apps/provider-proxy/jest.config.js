const common = {
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "./tsconfig.json" }]
  },
  rootDir: "."
};

module.exports = {
  collectCoverageFrom: ["./src/**/*.{js,ts}"],
  projects: [
    {
      displayName: "unit",
      ...common,
      testMatch: ["<rootDir>/test/**/*.spec.ts"],
      testPathIgnorePatterns: ["/node_modules", "test/functional"]
    },
    {
      displayName: "functional",
      ...common,
      testMatch: ["<rootDir>/test/functional/**/*.spec.ts"],
      setupFilesAfterEnv: ["./test/setup-functional-tests.ts"]
    }
  ]
};
