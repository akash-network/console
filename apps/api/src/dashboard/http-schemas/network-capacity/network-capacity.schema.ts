import z from "zod";

const statItemSchema = z.object({
  active: z.number(),
  pending: z.number(),
  available: z.number(),
  total: z.number()
});
export const NetworkCapacityResponseSchema = z.object({
  activeProviderCount: z.number(),
  resources: z.object({
    cpu: statItemSchema,
    gpu: statItemSchema,
    memory: statItemSchema,
    storage: z.object({
      ephemeral: statItemSchema,
      persistent: statItemSchema,
      total: statItemSchema
    })
  })
});

export type NetworkCapacityResponse = z.infer<typeof NetworkCapacityResponseSchema>;
