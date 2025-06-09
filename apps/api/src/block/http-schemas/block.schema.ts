import { z } from "@hono/zod-openapi";

const defaultLimit = 20;

export const ListBlocksQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(defaultLimit).openapi({
    type: "number",
    minimum: 1,
    maximum: 100,
    description: "Number of blocks to return",
    example: defaultLimit,
    default: defaultLimit
  })
});

export const ListBlocksResponseSchema = z.array(
  z.object({
    height: z.number(),
    proposer: z.object({
      address: z.string(),
      operatorAddress: z.string(),
      moniker: z.string(),
      avatarUrl: z.string().optional()
    }),
    transactionCount: z.number(),
    totalTransactionCount: z.number(),
    datetime: z.string()
  })
);

export const GetBlockByHeightParamsSchema = z.object({
  height: z.coerce.number().openapi({
    description: "Block Height",
    example: 12121212
  })
});

export const GetBlockByHeightResponseSchema = z.object({
  height: z.number(),
  datetime: z.string(),
  proposer: z.object({
    operatorAddress: z.string(),
    moniker: z.string(),
    avatarUrl: z.string().optional(),
    address: z.string()
  }),
  hash: z.string(),
  gasUsed: z.number(),
  gasWanted: z.number(),
  transactions: z.array(
    z.object({
      hash: z.string(),
      isSuccess: z.boolean(),
      error: z.string().nullable(),
      fee: z.number(),
      datetime: z.string(),
      messages: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          amount: z.number()
        })
      )
    })
  )
});

export type ListBlocksQuery = z.infer<typeof ListBlocksQuerySchema>;
export type ListBlocksResponse = z.infer<typeof ListBlocksResponseSchema>;
export type GetBlockByHeightParams = z.infer<typeof GetBlockByHeightParamsSchema>;
export type GetBlockByHeightResponse = z.infer<typeof GetBlockByHeightResponseSchema>;
