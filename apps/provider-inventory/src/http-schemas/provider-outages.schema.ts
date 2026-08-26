import { z } from "@hono/zod-openapi";

export const ProviderOutagesRequestSchema = z.object({
  minAgeDays: z
    .number({ coerce: true })
    .int()
    .nonnegative()
    .openapi({ description: "Only return outages that started at least this many days ago", example: 3 })
});
export type ProviderOutagesRequest = z.infer<typeof ProviderOutagesRequestSchema>;

const ProviderOutageSchema = z.object({
  provider: z.string().openapi({ description: "Provider address", example: "akash1q7spv2cw06yszgfp4f9ed59lkka6ytn8g4tkjf" }),
  hostUri: z.string().openapi({ description: "Provider HTTPS endpoint", example: "https://provider.europlots.com:8443" }),
  startedAt: z.string().datetime().openapi({ description: "When the provider stopped answering", example: "2026-01-01T00:00:00.000Z" }),
  lastAttemptAt: z.string().datetime().openapi({
    description: "When the provider was last dialled while still unreachable; a value far in the past means the outage record is stale",
    example: "2026-01-08T12:00:00.000Z"
  })
});

export const ProviderOutagesResponseSchema = z.object({
  outages: z.array(ProviderOutageSchema)
});
export type ProviderOutagesResponse = z.infer<typeof ProviderOutagesResponseSchema>;
