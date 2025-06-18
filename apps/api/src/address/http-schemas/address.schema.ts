import { z } from "@hono/zod-openapi";

import { openApiExampleAddress } from "@src/utils/constants";
import { AkashAddressSchema } from "@src/utils/schema";

const maxLimit = 100;

export const GetAddressParamsSchema = z.object({
  address: AkashAddressSchema.openapi({
    description: "Account Address",
    example: openApiExampleAddress
  })
});

export const GetAddressTransactionsParamsSchema = z.object({
  address: AkashAddressSchema.openapi({
    description: "Wallet Address",
    example: openApiExampleAddress
  }),
  skip: z.coerce.number().min(0).openapi({
    description: "Transactions to skip",
    example: 10
  }),
  limit: z.coerce.number().min(1).max(maxLimit).openapi({
    description: "Transactions to return",
    example: 10,
    maximum: maxLimit
  })
});

export const ValidatorSchema = z.object({
  address: z.string().optional(),
  moniker: z.string().optional(),
  operatorAddress: z.string().optional(),
  avatarUrl: z.string().optional()
});

export const DelegationSchema = z.object({
  validator: ValidatorSchema,
  amount: z.number(),
  reward: z.number().nullable()
});

export const AssetSchema = z.object({
  symbol: z.string().optional(),
  ibcToken: z.string().optional(),
  logoUrl: z.string().optional(),
  description: z.string().optional(),
  amount: z.number()
});

export const RedelegationSchema = z.object({
  srcAddress: ValidatorSchema,
  dstAddress: ValidatorSchema,
  creationHeight: z.number(),
  completionTime: z.string(),
  amount: z.number()
});

export const TransactionMessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: z.number(),
  isReceiver: z.boolean()
});

export const TransactionSchema = z.object({
  height: z.number(),
  datetime: z.string(),
  hash: z.string(),
  isSuccess: z.boolean(),
  error: z.string().nullable(),
  gasUsed: z.number(),
  gasWanted: z.number(),
  fee: z.number(),
  memo: z.string().nullable(),
  isSigner: z.boolean(),
  messages: z.array(TransactionMessageSchema)
});

export const GetAddressResponseSchema = z.object({
  total: z.number(),
  delegations: z.array(DelegationSchema),
  available: z.number(),
  delegated: z.number(),
  rewards: z.number(),
  assets: z.array(AssetSchema),
  redelegations: z.array(RedelegationSchema),
  commission: z.number(),
  latestTransactions: z.array(TransactionSchema)
});

export const GetAddressTransactionsResponseSchema = z.object({
  count: z.number(),
  results: z.array(TransactionSchema)
});

export type GetAddressResponse = z.infer<typeof GetAddressResponseSchema>;
export type GetAddressTransactionsParams = z.infer<typeof GetAddressTransactionsParamsSchema>;
export type GetAddressTransactionsResponse = z.infer<typeof GetAddressTransactionsResponseSchema>;
