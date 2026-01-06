import { createOtelLogger } from "@akashnetwork/logging/otel";

const logger = createOtelLogger({ name: `instrumentation-${process.env.NEXT_RUNTIME}` });

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const [, { serverEnvSchema }] = await Promise.all([import("@akashnetwork/env-loader"), import("./config/env-config.schema")]);

      serverEnvSchema.parse(process.env);
    } catch (error) {
      logger.error({ message: "Failed to validate server environment variables", error });
      process.exit(1);
    }
  }
}
