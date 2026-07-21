// @ts-check
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

import base from "./base.mjs";

export default tseslint.config(...base, {
  files: ["**/*.ts", "**/*.tsx"],
  extends: [...tseslint.configs.recommended, importX.flatConfigs.typescript],
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: "latest",
    sourceType: "module"
  },
  rules: {
    "@typescript-eslint/no-explicit-any": ["warn"],
    "@typescript-eslint/no-require-imports": ["error"],
    "@typescript-eslint/no-unused-expressions": ["off"],
    "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_", caughtErrors: "none" }]
  }
});
