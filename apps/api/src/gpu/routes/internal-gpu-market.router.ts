import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { GpuMarketController } from "@src/gpu/controllers/gpu-market/gpu-market.controller";
import { GpuMarketPricesResponseSchema, GpuMarketQuerySchema, GpuSupplyResponseSchema } from "@src/gpu/http-schemas/gpu-market.schema";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

export const internalGpuMarketRouter = new OpenApiHonoHandler();

const listMarketPricesRoute = createRoute({
  method: "get",
  path: "/gpu-market-prices",
  operationId: "listGpuMarketPrices",
  summary: "The latest market price range per gpu variant, region area and source, with the samples behind each",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: { query: GpuMarketQuerySchema },
  responses: {
    200: { description: "The stored ranges matching the filters", content: { "application/json": { schema: GpuMarketPricesResponseSchema } } },
    401: { description: "Missing or wrong internal token" }
  }
});

internalGpuMarketRouter.openapi(listMarketPricesRoute, async function routeListGpuMarketPrices(c) {
  return c.json(await container.resolve(GpuMarketController).listMarketPrices(c.req.valid("query")), 200);
});

const listSupplyRoute = createRoute({
  method: "get",
  path: "/gpu-supply",
  operationId: "listGpuSupply",
  summary: "Online gpu capacity per variant with the providers that really bid on it and their best bid",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: { query: GpuMarketQuerySchema },
  responses: {
    200: { description: "The gpu variants matching the filters", content: { "application/json": { schema: GpuSupplyResponseSchema } } },
    401: { description: "Missing or wrong internal token" }
  }
});

internalGpuMarketRouter.openapi(listSupplyRoute, async function routeListGpuSupply(c) {
  return c.json(await container.resolve(GpuMarketController).listSupply(c.req.valid("query")), 200);
});
