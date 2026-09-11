import tsConfig from "@akashnetwork/dev-config/eslint/typescript.mjs";

import isolatedUnitTests from "./test/isolated-unit-tests.json" with { type: "json" };

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
  },
  {
    files: ["src/**/*.spec.ts"],
    ignores: isolatedUnitTests,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value='tsyringe'], ImportExpression[source.value='tsyringe']",
          message: "Tests using the DI container must be listed in test/isolated-unit-tests.json."
        },
        {
          selector: "CallExpression[callee.property.name=/^(mock|doMock|unmock|doUnmock|resetModules|hoisted)$/], CallExpression[callee.property.value=/^(mock|doMock|unmock|doUnmock|resetModules|hoisted)$/]",
          message: "Module mocks require isolation. Use dependency injection or list this test in test/isolated-unit-tests.json."
        }
      ]
    }
  }
];
