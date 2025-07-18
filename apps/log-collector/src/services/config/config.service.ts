import process from "node:process";
import { singleton } from "tsyringe";
import { z } from "zod";

@singleton()
export class ConfigService {
  private readonly envSchema = z.intersection(
    z.object({
      HOSTNAME: z.string(),
      KUBERNETES_NAMESPACE_OVERRIDE: z.string().optional(),
      ENVIRONMENT: z.string().optional().default("default"),
      SOURCE: z.string().optional().default("akash.network"),
      WRITE_TO_CONSOLE: z
        .enum(["true", "false"])
        .transform(val => val === "true")
        .optional()
        .default("false")
    }),
    z.discriminatedUnion("DESTINATION", [
      z.object({
        DESTINATION: z.literal("DATADOG"),
        DD_SITE: z.string(),
        DD_API_KEY: z.string(),
        DATADOG_DEBUG: z
          .enum(["true", "false"])
          .transform(val => val === "true")
          .optional()
          .default("false")
      })
    ])
  );

  private readonly envConfig: z.infer<typeof this.envSchema>;

  constructor() {
    this.envConfig = this.envSchema.parse(process.env);
  }

  get<K extends keyof typeof this.envConfig>(key: K): (typeof this.envConfig)[K] {
    return this.envConfig[key];
  }

  getDatadogValue<K extends keyof Extract<typeof this.envConfig, { DESTINATION: "DATADOG" }>>(
    key: K
  ): Extract<typeof this.envConfig, { DESTINATION: "DATADOG" }>[K] {
    if (this.envConfig.DESTINATION === "DATADOG") {
      return this.envConfig[key];
    }
    throw new Error(`Configuration for destination "DATADOG" is not available. Current destination is "${this.envConfig.DESTINATION}"`);
  }
}
