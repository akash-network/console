export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      await import("@akashnetwork/env-loader");
      const { serverEnvSchema } = await import("./config/env-config.schema");

      serverEnvSchema.parse(process.env);
    } catch (error) {
      console.error("Failed to validate server environment variables", error);
      process.exit(1);
    }
  }
}
