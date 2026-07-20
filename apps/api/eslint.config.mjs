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
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@hono/zod-openapi",
              importNames: ["createRoute"],
              message: "Import createRoute from '@src/core/lib/create-route/create-route' instead to enforce security declaration."
            }
          ]
        }
      ]
    }
  }
];
