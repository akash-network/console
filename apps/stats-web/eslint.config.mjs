import nextConfig from "@akashnetwork/dev-config/eslint/next.mjs";

export default [
  ...nextConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "akash/dependencies-component-or-hook": ["error"]
    }
  }
];
