import nextConfig from "@akashnetwork/dev-config/eslint/next.mjs";

export default [
  ...nextConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "akash/dependencies-component-or-hook": ["error"],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "Import Link from @/components/Link/Link, which does not prefetch: every stats-web route renders on the server per request."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["**/src/components/Link/Link.ts", "**/src/components/Link/Link.spec.ts"],
    rules: {
      "no-restricted-imports": "off"
    }
  }
];
