import { z } from "zod";

export const schema = z
  .object({
    API_NODE_ENDPOINT: z.string(),
    CONSOLE_API_ENDPOINT: z.string().url().optional(),
    CONSOLE_API_SECRET_TOKEN: z.string().optional(),
    CONSOLE_WEB_URL: z.string(),
    DEPLOYMENT_BALANCE_BLOCKS_THROTTLE: z.number({ coerce: true }).optional().default(10),
    PROVIDER_MAINTENANCE_ALERTS_ENABLED: z
      .enum(["true", "false"])
      .optional()
      .default("false")
      .transform(value => value === "true"),
    PROVIDER_TIER_DEMOTION_ALERTS_ENABLED: z
      .enum(["true", "false"])
      .optional()
      .default("false")
      .transform(value => value === "true"),
    PROVIDER_TIER_DEMOTION_POLL_INTERVAL_MS: z.number({ coerce: true }).int().positive().optional().default(15000),
    PROVIDER_TIER_DEMOTION_PAGE_SIZE: z.number({ coerce: true }).int().min(1).max(100).optional().default(100)
  })
  .superRefine((env, context) => {
    if (env.PROVIDER_TIER_DEMOTION_ALERTS_ENABLED && !env.CONSOLE_API_ENDPOINT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CONSOLE_API_ENDPOINT"],
        message: "CONSOLE_API_ENDPOINT is required when provider tier-demotion alerts are enabled"
      });
    }
  });

export type AlertEnvConfig = z.infer<typeof schema>;
