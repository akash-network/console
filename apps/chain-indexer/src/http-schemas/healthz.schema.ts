import { z } from "zod";

export const HealthzResponseSchema = z.object({
  data: z.object({
    status: z.literal("ok")
  })
});

export type HealthzResponse = z.infer<typeof HealthzResponseSchema>;
