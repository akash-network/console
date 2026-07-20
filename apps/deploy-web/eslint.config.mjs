import nextConfig from "@akashnetwork/dev-config/eslint/next.mjs";

export default [
  ...nextConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@auth0/nextjs-auth0",
              message: "Import patched version of @auth0/nextjs-auth0 from @src/lib/auth0 instead of @auth0/nextjs-auth0."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["tests/ui/**/*.ts", "tests/ui/**/*.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off"
    }
  }
];
