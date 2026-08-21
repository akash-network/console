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
    ),
    deadLetters: z.object({
      total: z.number(),
      byType: z.array(
        z.object({
          type: z.string(),
          count: z.number()
        })
      )
    })
  })
});

export type StatusResponse = z.infer<typeof StatusResponseSchema>;
