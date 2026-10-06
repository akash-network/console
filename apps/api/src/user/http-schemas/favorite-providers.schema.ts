import { z } from "@hono/zod-openapi";

import { AkashAddressSchema } from "@src/utils/schema";

export const MAX_FAVORITE_PROVIDERS = 500;

export const FavoriteProvidersResponseSchema = z.object({
  data: z.object({
    providerAddresses: z.array(z.string()).openapi({ description: "In the order they were added, oldest first." })
  })
});

export const CreateFavoriteProvidersRequestSchema = z.object({
  data: z.object({
    providerAddresses: z
      .array(AkashAddressSchema)
      .min(1)
      .max(MAX_FAVORITE_PROVIDERS)
      .openapi({ description: `Providers to add. One already a favorite keeps its place. A user keeps at most ${MAX_FAVORITE_PROVIDERS}.` })
  })
});

export const DeleteFavoriteProviderParamsSchema = z.object({
  providerAddress: AkashAddressSchema.openapi({ param: { name: "providerAddress", in: "path" } })
});

export type FavoriteProvidersResponse = z.infer<typeof FavoriteProvidersResponseSchema>;
export type CreateFavoriteProvidersRequest = z.infer<typeof CreateFavoriteProvidersRequestSchema>;
