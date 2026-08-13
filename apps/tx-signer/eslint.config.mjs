import tsConfig from "@akashnetwork/dev-config/eslint/typescript.mjs";

export default [
  ...tsConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true
      }
    },
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": ["error"]
    }
  }
];
