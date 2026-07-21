import tsConfig from "@akashnetwork/dev-config/eslint/typescript.mjs";

export default [
  ...tsConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": ["error"]
    }
  }
];
