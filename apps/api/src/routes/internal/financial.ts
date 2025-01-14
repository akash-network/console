import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { FinancialStatsService } from "@src/billing/services/financial-stats/financial-stats.service";

const route = createRoute({
  method: "get",
  path: "/financial",
  summary: "Financial stats for trial usage",
  responses: {
    200: {
      description: "Financial stats for trial usage",
      content: {
        "application/json": {
          schema: z.object({})
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const financialStatsService = container.resolve(FinancialStatsService);

  const [masterBalanceUsdc, providerRevenues, communityPoolUsdc, akashPubProviderBalances, payingUserCount] = await Promise.all([
    financialStatsService.getMasterWalletBalanceUsdc(),
    financialStatsService.getProviderRevenues(),
    financialStatsService.getCommunityPoolUsdc(),
    financialStatsService.getAkashPubProviderBalances(),
    financialStatsService.getPayingUserCount()
  ]);

  const readyToRecycle = akashPubProviderBalances.map(x => x.balanceUsdc).reduce((a, b) => a + b, 0);

  return c.json({
    date: new Date(),
    trialBalanceUsdc: masterBalanceUsdc / 1_000_000,
    communityPoolUsdc: communityPoolUsdc / 1_000_000,
    readyToRecycle,
    payingUserCount,
    akashPubProviderBalances,
    providerRevenues: providerRevenues
  });
});
