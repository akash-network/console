import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { ProviderController } from "@src/provider/controllers/provider/provider.controller";
import {
  ProviderActiveLeasesGraphDataParamsSchema,
  ProviderActiveLeasesGraphDataResponseSchema,
  ProviderListQuerySchema,
  ProviderListResponseSchema
} from "@src/provider/http-schemas/provider.schema";
import { isValidBech32Address } from "@src/utils/addresses";

const route = createRoute({
  method: "get",
  path: "/v1/providers",
  summary: "Get a list of providers.",
  tags: ["Providers"],
  request: {
    query: ProviderListQuerySchema
  },
  responses: {
    200: {
      description: "Returns a list of providers",
      content: {
        "application/json": {
          schema: ProviderListResponseSchema
        }
      }
    }
  }
});

const activeLeasesGraphDataRoute = createRoute({
  method: "get",
  path: "/v1/providers/{providerAddress}/active-leases-graph-data",
  tags: ["Analytics", "Providers"],
  request: {
    params: ProviderActiveLeasesGraphDataParamsSchema
  },
  responses: {
    200: {
      description: "Returns a provider's active leases graph data",
      content: {
        "application/json": {
          schema: ProviderActiveLeasesGraphDataResponseSchema
        }
      }
    },
    400: {
      description: "Invalid address"
    }
  }
});

export const providersRouter = new OpenApiHonoHandler();

providersRouter.openapi(route, async function routeListProviders(c) {
  const { scope } = c.req.valid("query");
  const providers = await container.resolve(ProviderController).getProviderList(scope);

  return c.json(providers);
});

providersRouter.openapi(activeLeasesGraphDataRoute, async function routeProviderActiveLeasesGraphData(c) {
  const providerAddress = c.req.valid("param").providerAddress;

  if (!isValidBech32Address(providerAddress, "akash")) {
    return c.text("Invalid address", 400);
  }

  const graphData = await container.resolve(ProviderController).getProviderActiveLeasesGraphData(providerAddress);

  return c.json(graphData);
});
