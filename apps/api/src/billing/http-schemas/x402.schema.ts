import { z } from "@hono/zod-openapi";

import { SignTxResponseOutputSchema } from "@src/billing/http-schemas/tx.schema";

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

export const X402DeployRequestSchema = z.object({
  sdl: z.string().openapi({ description: "Akash SDL (YAML) describing the deployment to create" }),
  deposit: z.coerce.number().positive().openapi({
    description: "Deposit in USD that is both paid via x402 and used to fund the deployment. Bounds are configured server-side.",
    example: 5
  })
});

export const X402DeployResponseSchema = z.object({
  data: z.object({
    transactionId: z.string(),
    amountUsdCents: z.number(),
    network: z.string(),
    settlementTxHash: z.string(),
    payerAddress: z.string().optional(),
    deploymentDseq: z.string(),
    manifest: z.string(),
    signTx: SignTxResponseOutputSchema.shape.data
  })
});

export const X402DeployFailedResponseSchema = z
  .object({
    error: z.string(),
    code: z.literal("DEPLOY_FAILED_FUNDS_CREDITED"),
    message: z.string(),
    transactionId: z.string(),
    amountUsdCents: z.number(),
    settlementTxHash: z.string()
  })
  .openapi({
    description:
      "The USDC payment settled and your Console balance was credited, but the deployment could not be created. " +
      "The funds remain spendable in your Console balance; no on-chain reversal is attempted. Retry deployment via POST /v1/deployments."
  });

export type X402TopUpQuery = z.infer<typeof X402TopUpQuerySchema>;
export type X402TopUpResponse = z.infer<typeof X402TopUpResponseSchema>;
export type X402DeployRequest = z.infer<typeof X402DeployRequestSchema>;
export type X402DeployResponse = z.infer<typeof X402DeployResponseSchema>;
