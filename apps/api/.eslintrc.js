module.exports = {
  extends: [require.resolve("@akashnetwork/dev-config/.eslintrc.ts")],
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
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parserOptions: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true
      }
    }
  ]
};
