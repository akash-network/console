import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { ProviderController } from "@src/provider/controllers/provider/provider.controller";
import {
  ProviderActiveLeasesGraphDataParamsSchema,
  ProviderActiveLeasesGraphDataResponseSchema,
  ProviderListQuerySchema,
  ProviderListResponseSchema,
  ProviderParamsSchema,
  ProviderResponseSchema
} from "@src/provider/http-schemas/provider.schema";

const providerListRoute = createRoute({
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

const providerRoute = createRoute({
  method: "get",
  path: "/v1/providers/{address}",
  summary: "Get a provider details.",
  tags: ["Providers"],
  request: {
    params: ProviderParamsSchema
  },
  responses: {
    200: {
      description: "Return a provider details",
      content: {
        "application/json": {
          schema: ProviderResponseSchema
        }
      }
    },
    404: {
      description: "Provider not found"
    },
    400: {
      description: "Invalid address"
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

providersRouter.openapi(providerListRoute, async function routeListProviders(c) {
  const { scope } = c.req.valid("query");
  const providers = await container.resolve(ProviderController).getProviderList(scope);

  return c.json(providers);
});

providersRouter.openapi(providerRoute, async function routeGetProvider(c) {
  const { address } = c.req.valid("param");
  if (!address) {
    return c.text("Address is undefined.", 400);
  }

  const provider = await container.resolve(ProviderController).getProvider(address);

  if (!provider) {
    return c.text("Provider not found.", 404);
  }

  return c.json(provider);
});

providersRouter.openapi(activeLeasesGraphDataRoute, async function routeProviderActiveLeasesGraphData(c) {
  const providerAddress = c.req.valid("param").providerAddress;
  const graphData = await container.resolve(ProviderController).getProviderActiveLeasesGraphData(providerAddress);

  return c.json(graphData);
});
