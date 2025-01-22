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
      testMatch: ["<rootDir>/src/**/*.spec.ts"]
    },
    {
      displayName: "functional",
      ...common,
      testMatch: ["<rootDir>/test/functional/**/*.spec.ts"],
      setupFilesAfterEnv: ["./test/setup-functional-tests.ts"]
    }
  ]
};
