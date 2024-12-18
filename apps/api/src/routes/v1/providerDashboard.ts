import { Block } from "@akashnetwork/database/dbSchemas";
import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import subHours from "date-fns/subHours";
import { Op } from "sequelize";

import { getProviderActiveResourcesAtHeight, getProviderEarningsAtHeight, getProviderTotalLeaseCountAtHeight } from "@src/services/db/statsService";
import { openApiExampleProviderAddress } from "@src/utils/constants";

const route = createRoute({
  method: "get",
  path: "/provider-dashboard/{owner}",
  summary: "Get dashboard data for provider console.",
  tags: ["Providers"],
  request: {
    params: z.object({
      owner: z.string().openapi({ example: openApiExampleProviderAddress })
    })
  },
  responses: {
    200: {
      description: "Dashboard data",
      content: {
        "application/json": {
          schema: z.object({
            current: z.object({
              date: z.string(),
              height: z.number(),
              activeLeaseCount: z.number(),
              totalLeaseCount: z.number(),
              dailyLeaseCount: z.number(),
              totalUAktEarned: z.number(),
              dailyUAktEarned: z.number(),
              totalUUsdcEarned: z.number(),
              dailyUUsdcEarned: z.number(),
              totalUUsdEarned: z.number(),
              dailyUUsdEarned: z.number(),
              activeCPU: z.number(),
              activeGPU: z.number(),
              activeMemory: z.number(),
              activeEphemeralStorage: z.number(),
              activePersistentStorage: z.number(),
              activeStorage: z.number()
            }),
            previous: z.object({
              date: z.string(),
              height: z.number(),
              activeLeaseCount: z.number(),
              totalLeaseCount: z.number(),
              dailyLeaseCount: z.number(),
              totalUAktEarned: z.number(),
              dailyUAktEarned: z.number(),
              totalUUsdcEarned: z.number(),
              dailyUUsdcEarned: z.number(),
              totalUUsdEarned: z.number(),
              dailyUUsdEarned: z.number(),
              activeCPU: z.number(),
              activeGPU: z.number(),
              activeMemory: z.number(),
              activeEphemeralStorage: z.number(),
              activePersistentStorage: z.number(),
              activeStorage: z.number()
            })
          })
        }
      }
    },
    404: {
      description: "Provider not found"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const owner = c.req.param("owner");

  const provider = await Provider.findOne({
    where: { owner: owner }
  });

  if (!provider) {
    return c.json({ error: "Provider not found" }, 404);
  }

  const latestBlock = await Block.findOne({
    where: {
      isProcessed: true,
      totalUUsdSpent: { [Op.not]: null }
    },
    order: [["height", "DESC"]]
  });

  const [earlierBlock24h, earlierBlock48h] = await Promise.all([
    Block.findOne({
      order: [["datetime", "ASC"]],
      where: {
        datetime: { [Op.gte]: subHours(latestBlock.datetime, 24) }
      }
    }),
    Block.findOne({
      order: [["datetime", "ASC"]],
      where: {
        datetime: { [Op.gte]: subHours(latestBlock.datetime, 48) }
      }
    })
  ]);

  const [
    activeStats,
    previousActiveStats,
    currentTotalLeaseCount,
    previousTotalLeaseCount,
    secondPreviousTotalLeaseCount,
    currentTotalEarnings,
    previousTotalEarnings,
    secondPreviousTotalEarnings
  ] = await Promise.all([
    getProviderActiveResourcesAtHeight(owner, latestBlock.height),
    getProviderActiveResourcesAtHeight(owner, earlierBlock24h.height),
    getProviderTotalLeaseCountAtHeight(owner, latestBlock.height),
    getProviderTotalLeaseCountAtHeight(owner, earlierBlock24h.height),
    getProviderTotalLeaseCountAtHeight(owner, earlierBlock48h.height),
    getProviderEarningsAtHeight(owner, provider.createdHeight, latestBlock.height),
    getProviderEarningsAtHeight(owner, provider.createdHeight, earlierBlock24h.height),
    getProviderEarningsAtHeight(owner, provider.createdHeight, earlierBlock48h.height)
  ]);

  return c.json({
    current: {
      date: latestBlock.datetime,
      height: latestBlock.height,
      activeLeaseCount: activeStats.count,
      totalLeaseCount: currentTotalLeaseCount,
      dailyLeaseCount: currentTotalLeaseCount - previousTotalLeaseCount,
      totalUAktEarned: currentTotalEarnings.uakt,
      dailyUAktEarned: currentTotalEarnings.uakt - previousTotalEarnings.uakt,
      totalUUsdcEarned: currentTotalEarnings.uusdc,
      dailyUUsdcEarned: currentTotalEarnings.uusdc - previousTotalEarnings.uusdc,
      totalUUsdEarned: currentTotalEarnings.uusd,
      dailyUUsdEarned: currentTotalEarnings.uusd - previousTotalEarnings.uusd,
      activeCPU: activeStats.cpu,
      activeGPU: activeStats.gpu,
      activeMemory: activeStats.memory,
      activeEphemeralStorage: activeStats.ephemeralStorage,
      activePersistentStorage: activeStats.persistentStorage,
      activeStorage: activeStats.ephemeralStorage + activeStats.persistentStorage
    },
    previous: {
      date: earlierBlock24h.datetime,
      height: earlierBlock24h.height,
      activeLeaseCount: previousActiveStats.count,
      totalLeaseCount: previousTotalLeaseCount,
      dailyLeaseCount: previousTotalLeaseCount - secondPreviousTotalLeaseCount,
      totalUAktEarned: previousTotalEarnings.uakt,
      dailyUAktEarned: previousTotalEarnings.uakt - secondPreviousTotalEarnings.uakt,
      totalUUsdcEarned: previousTotalEarnings.uusdc,
      dailyUUsdcEarned: previousTotalEarnings.uusdc - secondPreviousTotalEarnings.uusdc,
      totalUUsdEarned: previousTotalEarnings.uusd,
      dailyUUsdEarned: previousTotalEarnings.uusd - secondPreviousTotalEarnings.uusd,
      activeCPU: previousActiveStats.cpu,
      activeGPU: previousActiveStats.gpu,
      activeMemory: previousActiveStats.memory,
      activeEphemeralStorage: previousActiveStats.ephemeralStorage,
      activePersistentStorage: previousActiveStats.persistentStorage,
      activeStorage: previousActiveStats.ephemeralStorage + previousActiveStats.persistentStorage
    }
  });
});
