const config = require("@akashnetwork/dev-config/.prettierrc");

module.exports = {
  ...config,
  overrides: [
    {
      files: "./apps/deploy-web/**",
      options: {
        tailwindConfig: "./apps/deploy-web/tailwind.config.ts"
      }
    },
    {
      files: "./apps/stats-web/**",
      options: {
        tailwindConfig: "./apps/stats-web/tailwind.config.ts"
      }
    }
  ]
};
