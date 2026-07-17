import { z } from "@hono/zod-openapi";

export const X402TopUpQuerySchema = z.object({
  amount: z.coerce.number().positive().openapi({
    description: "Top-up amount in USD (e.g. 25 or 25.5). Bounds are configured server-side.",
    example: 25
  })
});

export const X402TopUpResponseSchema = z.object({
  data: z.object({
    transactionId: z.string(),
    amountUsdCents: z.number(),
    network: z.string(),
    settlementTxHash: z.string(),
    payerAddress: z.string().optional()
  })
});

export const X402PaymentRequiredResponseSchema = z
  .object({
    x402Version: z.number(),
    error: z.string().optional(),
    code: z.string().optional().openapi({
      description: "Stable machine-readable error code (e.g. PAYMENT_REQUIRED, PAYMENT_INVALID)",
      example: "PAYMENT_REQUIRED"
    }),
    accepts: z.array(
      z
        .object({
          scheme: z.string(),
          network: z.string(),
          asset: z.string(),
          amount: z.string(),
          payTo: z.string(),
          maxTimeoutSeconds: z.number()
        })
        .passthrough()
    )
  })
  .passthrough()
  .openapi({
    description: "x402 payment-required body: retry the request with an X-PAYMENT header satisfying one of the accepted payment requirements"
  });

export const X402TransactionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25).openapi({
    description: "Maximum number of transactions to return (1-100).",
    example: 25
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: "Number of transactions to skip for pagination.",
    example: 0
  })
});

export const X402TransactionSchema = z.object({
  transactionId: z.string().openapi({ description: "Console transaction id (use to reconcile the top-up)." }),
  status: z.enum(["pending", "settled", "succeeded", "failed"]).openapi({ description: "Lifecycle status of the payment." }),
  amountUsdCents: z.number().openapi({ description: "Credited amount in USD cents." }),
  currency: z.string().openapi({ description: "ISO currency of the credited amount." }),
  network: z.string().openapi({ description: "CAIP-2 network id the payment settled on (e.g. eip155:8453)." }),
  asset: z.string().openapi({ description: "Settlement asset contract address (USDC)." }),
  settlementTxHash: z.string().nullable().openapi({ description: "On-chain settlement transaction hash, once settled." }),
  payerAddress: z.string().nullable().openapi({ description: "Wallet address that funded the payment." }),
  createdAt: z.string().openapi({ description: "ISO-8601 creation timestamp." })
});

export const X402TransactionListResponseSchema = z.object({
  data: z.array(X402TransactionSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number().openapi({ description: "Total number of transactions belonging to the caller." })
  })
});

export type X402TopUpQuery = z.infer<typeof X402TopUpQuerySchema>;
export type X402TopUpResponse = z.infer<typeof X402TopUpResponseSchema>;
export type X402TransactionListQuery = z.infer<typeof X402TransactionListQuerySchema>;
export type X402TransactionDto = z.infer<typeof X402TransactionSchema>;
export type X402TransactionListResponse = z.infer<typeof X402TransactionListResponseSchema>;
