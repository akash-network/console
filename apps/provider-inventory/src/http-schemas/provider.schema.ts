import { z } from "@hono/zod-openapi";

export const ProviderParamsSchema = z.object({
  owner: z.string().min(1).openapi({ description: "Provider address", example: "akash1q7spv2cw06yszgfp4f9ed59lkka6ytn8g4tkjf" })
});
export type ProviderParams = z.infer<typeof ProviderParamsSchema>;

export const ProviderResponseSchema = z.object({
  owner: z.string().openapi({ description: "Provider address", example: "akash1q7spv2cw06yszgfp4f9ed59lkka6ytn8g4tkjf" }),
  hostUri: z.string().openapi({ description: "Provider HTTPS endpoint", example: "https://provider.europlots.com:8443" }),
  isOnline: z.boolean().openapi({ description: "Whether the provider's inventory stream is currently connected" }),
  reclamationWindow: z.number().int().positive().nullable().openapi({
    description: "Seconds of notice the provider gives before it reclaims leased capacity, as it last reported; null when it reports none",
    example: 86400
  })
});
export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
