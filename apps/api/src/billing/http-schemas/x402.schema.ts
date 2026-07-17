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

export const X402DiscoveryResponseSchema = z
  .object({
    x402Version: z.number(),
    resources: z.array(
      z.object({
        resource: z.string().openapi({ description: "The protected route, as METHOD PATH (e.g. 'POST /v1/x402/top-up')" }),
        description: z.string(),
        mimeType: z.string(),
        accepts: z.array(
          z.object({
            scheme: z.string(),
            network: z.string().openapi({ description: "CAIP-2 settlement network id (e.g. eip155:8453)" }),
            payTo: z.string(),
            currency: z.string(),
            minAmountUsd: z.number(),
            maxAmountUsd: z.number(),
            maxTimeoutSeconds: z.number()
          })
        )
      })
    )
  })
  .openapi({
    description: "Public x402 discovery document: the list of payable resources and their accepted payment terms, mirroring the accepts a 402 response returns."
  });

export type X402TopUpQuery = z.infer<typeof X402TopUpQuerySchema>;
export type X402TopUpResponse = z.infer<typeof X402TopUpResponseSchema>;
export type X402DiscoveryResponse = z.infer<typeof X402DiscoveryResponseSchema>;
