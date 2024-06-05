const path = require("path");
const baseConfig = require("@akashnetwork/dev-config/.eslintrc.base");
const tsConfig = require("@akashnetwork/dev-config/.eslintrc.ts");
const nextConfig = require("@akashnetwork/dev-config/.eslintrc.next");

module.exports = {
  ...baseConfig,
  settings: {
    next: {
      rootDir: "apps/*"
    }
  },
  overrides: [
    ...baseConfig.overrides,
    ...tsConfig.overrides,
    ...nextConfig.overrides.map(override => ({
      ...override,
      files: ["apps/*-web/**/*.{ts,tsx}", "apps/landing/**/*.{ts,tsx}"],
      rules: {
        "@next/next/no-html-link-for-pages": ["error", ["deploy-web", "landing"].map(app => path.resolve(__dirname, `apps/${app}/src/pages`))]
      }
    }))
  ]
};
