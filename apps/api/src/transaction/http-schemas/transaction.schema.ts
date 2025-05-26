import { z } from "@hono/zod-openapi";

import { openApiExampleTransactionHash } from "@src/utils/constants";

const defaultLimit = 20;

export const ListTransactionsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(defaultLimit).optional().openapi({
    type: "number",
    minimum: 1,
    maximum: 100,
    description: "Number of transactions to return",
    example: defaultLimit,
    default: defaultLimit
  })
});

export const ListTransactionsResponseSchema = z.array(
  z.object({
    height: z.number(),
    datetime: z.string(),
    hash: z.string(),
    isSuccess: z.boolean(),
    error: z.string().nullable(),
    gasUsed: z.number(),
    gasWanted: z.number(),
    fee: z.number(),
    memo: z.string(),
    messages: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        amount: z.number()
      })
    )
  })
);

export const GetTransactionByHashParamsSchema = z.object({
  hash: z.string().openapi({
    description: "Transaction hash",
    example: openApiExampleTransactionHash
  })
});

export const GetTransactionByHashResponseSchema = z.object({
  height: z.number(),
  datetime: z.string(),
  hash: z.string(),
  isSuccess: z.boolean(),
  multisigThreshold: z.number().optional(),
  signers: z.array(z.string()),
  error: z.string().nullable(),
  gasUsed: z.number(),
  gasWanted: z.number(),
  fee: z.number(),
  memo: z.string(),
  messages: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      data: z.record(z.string()),
      relatedDeploymentId: z.string().optional()
    })
  )
});

export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
export type ListTransactionsResponse = z.infer<typeof ListTransactionsResponseSchema>;
export type GetTransactionByHashParams = z.infer<typeof GetTransactionByHashParamsSchema>;
export type GetTransactionByHashResponse = z.infer<typeof GetTransactionByHashResponseSchema>;
