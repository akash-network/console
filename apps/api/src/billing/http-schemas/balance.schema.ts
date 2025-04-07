import { z } from "zod";

export const GetBalancesResponseOutputSchema = z.object({
  data: z.object({
    balance: z.number(),
    deployments: z.number(),
    total: z.number()
  })
});

export type GetBalancesResponseOutput = z.infer<typeof GetBalancesResponseOutputSchema>;
