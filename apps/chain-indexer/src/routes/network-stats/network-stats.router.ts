import createError from "http-errors";
import { container } from "tsyringe";

import { GetNetworkStatsQuerySchema, GetNetworkStatsResponseSchema } from "@src/http-schemas/network-stats.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { NetworkStatsService } from "@src/services/network-stats/network-stats.service";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const networkStatsRouter = new OpenApiHonoHandler();

const getNetworkStatsRoute = createRoute({
  method: "get",
  path: "/v1/network-stats",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getNetworkStats",
  summary: "Get the current network activity and the most recent closed days",
  tags: ["Network"],
  request: {
    query: GetNetworkStatsQuerySchema
  },
  responses: {
    200: {
      description: "Active leases, resources and spend as of the last aggregated block, plus per-day rollups",
      content: {
        "application/json": {
          schema: GetNetworkStatsResponseSchema
        }
      }
    },
    404: {
      description: "No block has been aggregated yet"
    }
  }
});

networkStatsRouter.openapi(getNetworkStatsRoute, async function routeGetNetworkStats(c) {
  const { days } = c.req.valid("query");
  const stats = await container.resolve(NetworkStatsService).getStats({ days });
  if (!stats) {
    throw createError(404, "Network stats are not available yet");
  }
  return c.json({ data: stats }, 200);
});
