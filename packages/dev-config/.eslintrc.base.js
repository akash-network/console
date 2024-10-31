module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended"],
  plugins: ["simple-import-sort"],
  ignorePatterns: ["node_modules", "dist", "build", "public", "Leap"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    "simple-import-sort/imports": [
      "error",
      {
        groups: [["^\\u0000"], ["^react", "^(?!(@src|@test))@?\\w"], ["^@src", "^\\.\\.(?!/?$)", "^\\.\\./?$", "^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"]]
      }
    ],
    "space-infix-ops": ["error", { int32Hint: false }],
    "object-curly-spacing": ["error", "always"]
  },
  overrides: [
    {
      files: ["**/sentry.*.config.js"],
      parserOptions: {
        sourceType: "module"
      }
    }
  ]
};
