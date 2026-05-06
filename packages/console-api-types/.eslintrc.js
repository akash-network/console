module.exports = {
  extends: [require.resolve("@akashnetwork/dev-config/.eslintrc.ts")],
  ignorePatterns: ["src/schema.d.ts", "src/operations.gen.ts"]
};
