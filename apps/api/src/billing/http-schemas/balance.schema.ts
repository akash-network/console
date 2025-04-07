import { z } from "zod";

export const GetBalancesResponseOutputSchema = z.object({
  data: z.object({
    balance: z.number(),
    deployments: z.number(),
    total: z.number()
  })
});

export const GetBalancesQuerySchema = z.object({
  address: z.string().optional().describe("Optional wallet address to fetch balances for instead of the current user")
});

export type GetBalancesResponseOutput = z.infer<typeof GetBalancesResponseOutputSchema>;
export type GetBalancesQuery = z.infer<typeof GetBalancesQuerySchema>;
