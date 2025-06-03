import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { MarketDataController } from "@src/dashboard/controllers/market-data/market-data.controller";
import { MarketDataParamsSchema, MarketDataResponseSchema } from "@src/dashboard/http-schemas/market-data/market-data.schema";

const marketDataRoute = createRoute({
  method: "get",
  path: "/v1/market-data/{coin?}",
  tags: ["Analytics"],
  request: {
    params: MarketDataParamsSchema
  },
  responses: {
    200: {
      description: "Returns market stats",
      content: {
        "application/json": {
          schema: MarketDataResponseSchema
        }
      }
    }
  }
});

export const marketDataRouter = new OpenApiHonoHandler();

marketDataRouter.openapi(marketDataRoute, async c => {
  const { coin } = c.req.valid("param");

  const response = await container.resolve(MarketDataController).getMarketData(coin);
  return c.json(response);
});
