module.exports = {
  extends: [require.resolve('@akashnetwork/dev-config/.eslintrc.ts')],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
      },
    },
  ],
};
