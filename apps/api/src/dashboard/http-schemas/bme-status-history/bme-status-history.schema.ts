import { z } from "zod";

export const BmeStatusHistoryResponseSchema = z.array(
  z.object({
    height: z.number().openapi({ example: 12345678 }),
    date: z.date().openapi({ example: "2024-01-01T00:00:00.000Z" }),
    previousStatus: z.string().openapi({ example: "healthy" }),
    newStatus: z.string().openapi({ example: "warning" }),
    collateralRatio: z.number().openapi({ example: 1.5 })
  })
);

export type BmeStatusHistoryResponse = z.infer<typeof BmeStatusHistoryResponseSchema>;
