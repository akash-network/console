import { z } from "@hono/zod-openapi";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const ListBlocksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT).openapi({
    description: "Number of most recent blocks to return",
    example: DEFAULT_LIMIT,
    default: DEFAULT_LIMIT,
    maximum: MAX_LIMIT
  })
});

export const ProposerSchema = z.object({
  address: z.string().openapi({ description: "Consensus (hex) address of the proposer" }),
  operatorAddress: z.string().nullable(),
  moniker: z.string().nullable()
});

export const BlockSummarySchema = z.object({
  height: z.number(),
  datetime: z.string(),
  hash: z.string(),
  proposer: ProposerSchema,
  transactionCount: z.number()
});

export const ListBlocksResponseSchema = z.object({
  data: z.array(BlockSummarySchema)
});

export const GetBlockParamsSchema = z.object({
  height: z.coerce.number().int().positive().openapi({ description: "Block height", example: 12121212 })
});

export const CoinSchema = z.object({
  denom: z.string(),
  amount: z.string()
});

export const TransactionMessageSchema = z.object({
  index: z.number(),
  type: z.string()
});

export const BlockTransactionSchema = z.object({
  index: z.number(),
  hash: z.string(),
  code: z.number(),
  gasUsed: z.number(),
  gasWanted: z.number(),
  fee: z.array(CoinSchema),
  messages: z.array(TransactionMessageSchema)
});

export const GetBlockResponseSchema = z.object({
  data: BlockSummarySchema.extend({
    parentHash: z.string().nullable(),
    transactions: z.array(BlockTransactionSchema)
  })
});

export type ListBlocksQuery = z.infer<typeof ListBlocksQuerySchema>;
export type BlockSummary = z.infer<typeof BlockSummarySchema>;
export type ListBlocksResponse = z.infer<typeof ListBlocksResponseSchema>;
export type GetBlockResponse = z.infer<typeof GetBlockResponseSchema>;
export type BlockTransaction = z.infer<typeof BlockTransactionSchema>;
