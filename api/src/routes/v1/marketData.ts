import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { getMarketData } from "@src/providers/marketDataProvider";

const route = createRoute({
  method: "get",
  path: "/market-data",
  tags: ["Analytics"],
  responses: {
    200: {
      description: "Returns market stats",
      content: {
        "application/json": {
          schema: z.object({
            price: z.number(),
            volume: z.number(),
            marketCap: z.number(),
            marketCapRank: z.number(),
            priceChange24h: z.number(),
            priceChangePercentage24: z.number()
          })
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const response = await cacheResponse(60 * 5, cacheKeys.getMarketData, getMarketData);
  return c.json(response);
});
