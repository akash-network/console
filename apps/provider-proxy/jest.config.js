const common = {
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "./tsconfig.json" }]
  },
  rootDir: "."
};

module.exports = {
  collectCoverageFrom: [
    // keep new line
    "./src/**/*.{js,ts}",
    "!src/**/*.spec.ts",
    "!src/**/*.d.ts",
    "!src/server.ts"
  ],
  projects: [
    {
      displayName: "unit",
      ...common,
      testMatch: ["<rootDir>/test/**/*.spec.ts", "<rootDir>/src/**/*.spec.ts"],
      testPathIgnorePatterns: ["/node_modules", "test/functional"]
    },
    {
      displayName: "functional",
      ...common,
      testMatch: ["<rootDir>/test/functional/**/*.spec.ts"]
    }
  ]
};
