import { z } from "zod";

export const appConfigSchema = z
  .object({
    REST_API_NODE_URL: z.string().url(),
    ALLOW_PROXY_TO_LOCAL_NETWORK: z
      .enum(["true", "false"])
      .default("false")
      .transform(val => val === "true"),
    PORT: z.number({ coerce: true }).min(0).default(3040),
    PROVIDER_UNREACHABLE_TRACKING_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform(val => val === "true"),
    PROVIDER_UNREACHABLE_FAILURE_THRESHOLD: z.number({ coerce: true }).min(1).default(3),
    PROVIDER_UNREACHABLE_COOLDOWN_MS: z.number({ coerce: true }).min(0).default(60_000),
    PROVIDER_UNREACHABLE_MAX_COOLDOWN_MS: z
      .number({ coerce: true })
      .min(0)
      .default(15 * 60_000)
  })
  .refine(config => config.PROVIDER_UNREACHABLE_MAX_COOLDOWN_MS >= config.PROVIDER_UNREACHABLE_COOLDOWN_MS, {
    message: "PROVIDER_UNREACHABLE_MAX_COOLDOWN_MS caps the backoff, so it cannot be shorter than PROVIDER_UNREACHABLE_COOLDOWN_MS",
    path: ["PROVIDER_UNREACHABLE_MAX_COOLDOWN_MS"]
  });

export type AppConfig = z.infer<typeof appConfigSchema>;
export type AppConfigInput = z.input<typeof appConfigSchema>;
