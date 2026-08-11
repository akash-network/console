import { z } from "zod";

export const StatusResponseSchema = z.object({
  data: z.object({
    network: z.string(),
    role: z.string(),
    checkpoints: z.array(
      z.object({
        stream: z.string(),
        lastHeight: z.number(),
        updatedAt: z.string()
      })
    )
  })
});

export type StatusResponse = z.infer<typeof StatusResponseSchema>;
