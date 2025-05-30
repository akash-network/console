import { z } from "zod";

import { AuthorizedGraphDataNames } from "@src/services/db/statsService";

export const GraphDataParamsSchema = z.object({
  dataName: z.string().openapi({ example: "dailyUAktSpent", enum: AuthorizedGraphDataNames })
});

export const GraphDataResponseSchema = z.object({
  currentValue: z.number(),
  compareValue: z.number(),
  snapshots: z.array(
    z.object({
      date: z.date().openapi({ example: "2021-07-01T00:00:00.000Z" }),
      value: z.number().openapi({ example: 100 })
    })
  )
});

export type GraphDataParams = z.infer<typeof GraphDataParamsSchema>;
export type GraphDataResponse = z.infer<typeof GraphDataResponseSchema>;
