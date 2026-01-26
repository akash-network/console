import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { MarketDataController } from "@src/dashboard/controllers/market-data/market-data.controller";
import { MarketDataParamsSchema, MarketDataResponseSchema } from "@src/dashboard/http-schemas/market-data/market-data.schema";

export const marketDataRouter = new OpenApiHonoHandler();

const marketDataRoute = createRoute({
  method: "get",
  path: "/v1/market-data/{coin?}",
  tags: ["Analytics"],
  security: SECURITY_NONE,
  cache: { maxAge: 300, staleWhileRevalidate: 600 },
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
marketDataRouter.openapi(marketDataRoute, async c => {
  const { coin } = c.req.valid("param");

  const response = await container.resolve(MarketDataController).getMarketData(coin);
  return c.json(response);
});
