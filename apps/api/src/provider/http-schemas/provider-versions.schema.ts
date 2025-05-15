import { z } from "zod";

export const ProviderVersionsResponseSchema = z.record(
  z.string(),
  z.object({
    version: z.string(),
    count: z.number(),
    ratio: z.number(),
    providers: z.array(z.string())
  })
);

export type ProviderVersionsResponse = z.infer<typeof ProviderVersionsResponseSchema>;
