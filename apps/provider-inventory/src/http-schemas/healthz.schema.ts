import { z } from "zod";

export const HealthzResponseSchema = z.object({
  data: z.object({
    status: z.enum(["ok", "error"])
  })
});

export type HealthzResponse = z.infer<typeof HealthzResponseSchema>;
