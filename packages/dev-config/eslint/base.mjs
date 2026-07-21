// @ts-check
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import akash from "eslint-plugin-akash";
import importX from "eslint-plugin-import-x";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/public/**",
      "**/.next/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/storybook-static/**",
      "**/next-env.d.ts",
      "**/env-config.schema.js"
    ]
  },
  js.configs.recommended,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "import-x": importX,
      "@stylistic": stylistic,
      akash
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["./tsconfig.json"]
        }
      },
      "import-x/external-module-folders": ["node_modules", "dist", "build", "public"]
    },
    rules: {
      "no-useless-assignment": "off",
      "preserve-caught-error": "off",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [["^\\u0000"], ["^react", "^(?!(@src|@test))@?\\w"], ["^@src", "^\\.\\.(?!/?$)", "^\\.\\./?$", "^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"]]
        }
      ],
      "@stylistic/space-infix-ops": ["error", { int32Hint: false }],
      "@stylistic/object-curly-spacing": ["error", "always"],
      "import-x/no-extraneous-dependencies": ["error"],
      "import-x/no-cycle": ["error", { ignoreExternal: true }],
      "import-x/no-self-import": ["error"],
      "import-x/no-useless-path-segments": ["error"],
      "akash/no-mnemonic": ["error"],
      "akash/operation-id-format": [
        "error",
        {
          additionalVerbs: {
            get: { collection: ["export"] },
            post: { collection: ["deposit", "screen", "apply", "validate", "confirm"] },
            delete: { single: ["close"] }
          }
        }
      ]
    }
  },
  {
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs"
    }
  },
  {
    files: ["**/sentry.*.config.js", "**/packages/releaser/**/*.js"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022
    }
  }
];
