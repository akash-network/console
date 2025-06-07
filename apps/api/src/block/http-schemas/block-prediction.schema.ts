import { z } from "@hono/zod-openapi";

const defaultBlockWindow = 10_000;

export const GetPredictedBlockDateParamsSchema = z.object({
  height: z.coerce.number().openapi({ type: "number", description: "Block height", example: 20000000 })
});
export type GetPredictedBlockDateParams = z.infer<typeof GetPredictedBlockDateParamsSchema>;

export const GetPredictionQuerySchema = z.object({
  blockWindow: z.number().optional().default(defaultBlockWindow).openapi({
    description: "Block window",
    example: defaultBlockWindow,
    default: defaultBlockWindow
  })
});
export type GetPredictionQuery = z.infer<typeof GetPredictionQuerySchema>;

export const GetPredictedBlockDateResponseSchema = z.object({
  predictedDate: z.string(),
  height: z.number().openapi({ example: 10_000_000 }),
  blockWindow: z.number().openapi({ example: defaultBlockWindow })
});
export type GetPredictedBlockDateResponse = z.infer<typeof GetPredictedBlockDateResponseSchema>;

export const GetPredictedDateHeightParamsSchema = z.object({
  timestamp: z.coerce.number().openapi({ type: "number", description: "Unix Timestamp", example: 1704392968 })
});
export type GetPredictedDateHeightParams = z.infer<typeof GetPredictedDateHeightParamsSchema>;

export const GetPredictedDateHeightResponseSchema = z.object({
  predictedHeight: z.number().openapi({ example: 10_000_000 }),
  date: z.string().openapi({ example: "2024-01-04T18:29:28.000Z" }),
  blockWindow: z.number().openapi({ example: defaultBlockWindow })
});
export type GetPredictedDateHeightResponse = z.infer<typeof GetPredictedDateHeightResponseSchema>;
