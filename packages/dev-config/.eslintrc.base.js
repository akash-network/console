module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended"],
  plugins: ["simple-import-sort", "import-x", "akash"],
  settings: {
    "import-x/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: ["./tsconfig.json"]
      }
    },
    "import-x/external-module-folders": ["node_modules", "dist", "build", "public"]
  },
  ignorePatterns: ["node_modules", "dist", "build", "public", "**/next-env.d.ts", "**/env-config.schema.js"],
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
    "import-x/no-useless-path-segments": ["error"],
    "akash/no-mnemonic": ["error"],
    "akash/operation-id-format": [
      "error",
      {
        additionalVerbs: {
          post: { collection: ["deposit", "screen"] },
          delete: { single: ["close"] }
        }
      }
    ]
  },
  overrides: [
    {
      files: ["**/sentry.*.config.js", "**/packages/releaser/**/*.js"],
      parserOptions: {
        sourceType: "module",
        ecmaVersion: 2022
      }
    }
  ]
};
