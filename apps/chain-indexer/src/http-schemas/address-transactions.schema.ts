import { z } from "@hono/zod-openapi";

import { CoinSchema, TransactionMessageSchema } from "@src/http-schemas/blocks.schema";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Bech32 account addresses on Akash: 38 characters for 20-byte keys, 58 for 32-byte module accounts. */
const AKASH_ADDRESS_PATTERN = /^akash1[02-9ac-hj-np-z]{38,58}$/;

export const ListAddressTransactionsParamsSchema = z.object({
  address: z.string().regex(AKASH_ADDRESS_PATTERN, "Invalid akash address").openapi({
    description: "Account address",
    example: "akash1xvavd9cad6cxk4k3ac8jwsahfwp4xlwe2s08nv"
  })
});

export const ListAddressTransactionsQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).optional().default(0).openapi({ description: "Transactions to skip, newest first", example: 0, default: 0 }),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT).openapi({
    description: "Transactions to return",
    example: DEFAULT_LIMIT,
    default: DEFAULT_LIMIT,
    maximum: MAX_LIMIT
  })
});

export const AccountTxRoleSchema = z.enum(["signer", "sender", "receiver"]);

export const AddressTransactionSchema = z.object({
  height: z.number(),
  datetime: z.string(),
  hash: z.string(),
  code: z.number(),
  gasUsed: z.number(),
  gasWanted: z.number(),
  fee: z.array(CoinSchema),
  roles: z.array(AccountTxRoleSchema).openapi({ description: "How the address took part: it signed the transaction, or sent or received coins in it" }),
  messages: z.array(TransactionMessageSchema)
});

export const ListAddressTransactionsResponseSchema = z.object({
  data: z.object({
    total: z.number(),
    transactions: z.array(AddressTransactionSchema)
  })
});

export type ListAddressTransactionsQuery = z.infer<typeof ListAddressTransactionsQuerySchema>;
export type AddressTransaction = z.infer<typeof AddressTransactionSchema>;
export type ListAddressTransactionsResponse = z.infer<typeof ListAddressTransactionsResponseSchema>;
