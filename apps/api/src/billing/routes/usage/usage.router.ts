import { container } from "tsyringe";

import { UsageController } from "@src/billing/controllers/usage/usage.controller";
import { GetUsageHistoryQuerySchema, UsageHistoryResponseSchema, UsageHistoryStatsResponseSchema } from "@src/billing/http-schemas/usage.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

const getUsageHistoryRoute = createRoute({
  method: "get",
  path: "/v1/usage/history",
  summary: "Get historical data of billing and usage for a wallet address.",
  tags: ["Billing"],
  security: SECURITY_NONE,

  request: {
    query: GetUsageHistoryQuerySchema
  },
  responses: {
    200: {
      description: "Returns billing and usage data",
      content: {
        "application/json": {
          schema: UsageHistoryResponseSchema
        }
      }
    },
    400: {
      description:
        "Invalid address format or invalid date range: dates must be YYYY-MM-DD, startDate must not be after endDate and the range cannot exceed 366 days"
    }
  }
});

const getUsageHistoryStatsRoute = createRoute({
  method: "get",
  path: "/v1/usage/history/stats",
  summary: "Get historical usage stats for a wallet address.",
  tags: ["Billing"],
  security: SECURITY_NONE,
  request: {
    query: GetUsageHistoryQuerySchema
  },
  responses: {
    200: {
      description: "Returns usage stats data",
      content: {
        "application/json": {
          schema: UsageHistoryStatsResponseSchema
        }
      }
    },
    400: {
      description:
        "Invalid address format or invalid date range: dates must be YYYY-MM-DD, startDate must not be after endDate and the range cannot exceed 366 days"
    }
  }
});

export const usageRouter = new OpenApiHonoHandler();

usageRouter.openapi(getUsageHistoryRoute, async function routeGetBillingUsage(c) {
  const { address, startDate, endDate } = c.req.valid("query");
  const usageHistory = await container.resolve(UsageController).getHistory(address, startDate, endDate);
  return c.json(usageHistory);
});

usageRouter.openapi(getUsageHistoryStatsRoute, async function routeGetBillingOverview(c) {
  const { address, startDate, endDate } = c.req.valid("query");
  const usageHistoryStats = await container.resolve(UsageController).getHistoryStats(address, startDate, endDate);
  return c.json(usageHistoryStats);
});
