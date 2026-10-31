import { z } from "@hono/zod-openapi";

import { AkashAddressSchema } from "@src/utils/schema";

export const GetBalancesResponseOutputSchema = z.object({
  data: z.object({
    balance: z.number(),
    deployments: z.number(),
    total: z.number()
  })
});

export const GetBalancesQuerySchema = z.object({
  address: AkashAddressSchema.optional().describe("Optional wallet address to fetch balances for instead of the current user")
});

const CoinSchema = z.object({
  denom: z.string(),
  amount: z.string()
});

export const WalletBalancesResponseSchema = z.object({
  data: z.object({
    balances: z.array(CoinSchema).openapi({ description: "What the wallet holds, per denom." }),
    deploymentGrants: z.array(CoinSchema).openapi({ description: "What the wallet's unexpired deposit grants let it spend on deployments, summed per denom." }),
    activeDeployments: z
      .array(
        z.object({
          dseq: z.string(),
          escrow: z.object({
            funds: z.array(CoinSchema),
            settledAt: z.number().openapi({ description: "Height the escrow last settled at. The funds exclude what the deployment spent since." })
          })
        })
      )
      .openapi({ description: "The wallet's active deployments and what their escrow holds." })
  })
});

export const FeeAllowancesResponseSchema = z.object({
  data: z
    .array(
      z.object({
        granter: z.string(),
        spendLimit: z.array(CoinSchema),
        expiration: z.string().nullable()
      })
    )
    .openapi({ description: "The unexpired fee allowances granted to the wallet." })
});

export type GetBalancesResponseOutput = z.infer<typeof GetBalancesResponseOutputSchema>;
export type GetBalancesQuery = z.infer<typeof GetBalancesQuerySchema>;
export type WalletBalancesResponse = z.infer<typeof WalletBalancesResponseSchema>;
export type FeeAllowancesResponse = z.infer<typeof FeeAllowancesResponseSchema>;
