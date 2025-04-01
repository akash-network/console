module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended"],
  plugins: ["simple-import-sort", "import-x"],
  settings: {
    "import-x/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: ["./tsconfig.json"]
      }
    },
    "import-x/external-module-folders": ["node_modules", "dist", "build", "public", "Leap"]
  },
  ignorePatterns: ["node_modules", "dist", "build", "public", "Leap"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
    "simple-import-sort/imports": [
      "error",
      {
        groups: [
          // keep new line
          ["^\\u0000"],
          ["^react", "^(?!(@src|@test))@?\\w"],
          ["^@src", "^\\.\\.(?!/?$)", "^\\.\\./?$", "^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"]
        ]
      }
    ],
    "space-infix-ops": ["error", { int32Hint: false }],
    "object-curly-spacing": ["error", "always"],
    "import-x/no-extraneous-dependencies": ["error"],
    "import-x/no-cycle": ["error", { ignoreExternal: true }],
    "import-x/no-self-import": ["error"],
    "import-x/no-useless-path-segments": ["error"]
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
