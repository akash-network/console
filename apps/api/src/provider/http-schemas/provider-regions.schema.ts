import { z } from "zod";

export const ProviderRegionsResponseSchema = z.array(
  z.object({
    providers: z.array(z.string()),
    key: z.string(),
    description: z.string(),
    value: z.string().optional() // TODO: Keep?
  })
);

export type ProviderRegionsResponse = z.infer<typeof ProviderRegionsResponseSchema>;
