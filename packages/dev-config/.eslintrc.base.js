module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended"],
  plugins: ["simple-import-sort"],
  ignorePatterns: ["node_modules", "dist", "build", "public"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    "simple-import-sort/imports": [
      "error",
      {
        groups: [["^react", "^(?!@src)@?\\w"], ["^@src", "^\\.\\.(?!/?$)", "^\\.\\./?$", "^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"], ["^\\u0000"]]
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
