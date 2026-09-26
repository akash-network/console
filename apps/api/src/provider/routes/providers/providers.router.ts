import type { TypedResponse } from "hono";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProviderController } from "@src/provider/controllers/provider/provider.controller";
import type { ProviderListResponse } from "@src/provider/http-schemas/provider.schema";
import {
  ProviderActiveLeasesGraphDataParamsSchema,
  ProviderActiveLeasesGraphDataResponseSchema,
  ProviderListQuerySchema,
  ProviderListResponseSchema,
  ProviderLocationsResponseSchema,
  ProviderParamsSchema,
  ProviderResponseSchema,
  ProviderSearchQuerySchema,
  ProviderSearchResponseSchema
} from "@src/provider/http-schemas/provider.schema";

export const providersRouter = new OpenApiHonoHandler();

const providerListRoute = createRoute({
  method: "get",
  path: "/v1/providers",
  summary: "Get a list of providers.",
  tags: ["Providers"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
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

providersRouter.openapi(providerListRoute, async function routeListProviders(c) {
  const { scope, addresses } = c.req.valid("query");
  const controller = container.resolve(ProviderController);

  if (addresses) {
    const data = await controller.getFilteredProviderList(scope, addresses);
    return c.json(data) as TypedResponse<ProviderListResponse, 200, "json">;
  }

  const buffer = await controller.getProviderListBuffer(scope);
  return new Response(buffer, {
    status: 200,
    headers: { "Content-Type": "application/json" }
  }) as unknown as TypedResponse<ProviderListResponse, 200, "json">;
});

const providerSearchRoute = createRoute({
  method: "get",
  path: "/v1/provider-search",
  summary: "Search providers, one page at a time.",
  description: "Filters and sorts every provider on the network, then answers the requested page along with how many providers matched.",
  tags: ["Providers"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
  request: {
    query: ProviderSearchQuerySchema
  },
  responses: {
    200: {
      description: "Returns a page of the providers matching the search",
      content: {
        "application/json": {
          schema: ProviderSearchResponseSchema
        }
      }
    },
    400: {
      description: "Invalid search parameters"
    }
  }
});

providersRouter.openapi(providerSearchRoute, async function routeSearchProviders(c) {
  return c.json(await container.resolve(ProviderController).searchProviders(c.req.valid("query")), 200);
});

const providerLocationsRoute = createRoute({
  method: "get",
  path: "/v1/provider-locations",
  summary: "Get where each online provider is.",
  description: "Locates every online provider by its IP address, for drawing providers on a map without loading the full provider list.",
  tags: ["Providers"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
  responses: {
    200: {
      description: "Returns the location of every online provider",
      content: {
        "application/json": {
          schema: ProviderLocationsResponseSchema
        }
      }
    }
  }
});

providersRouter.openapi(providerLocationsRoute, async function routeListProviderLocations(c) {
  return c.json(await container.resolve(ProviderController).findProviderLocations(), 200);
});

const providerRoute = createRoute({
  method: "get",
  path: "/v1/providers/{address}",
  summary: "Get a provider details.",
  tags: ["Providers"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
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

const activeLeasesGraphDataRoute = createRoute({
  method: "get",
  path: "/v1/providers/{providerAddress}/active-leases-graph-data",
  tags: ["Analytics", "Providers"],
  security: SECURITY_NONE,
  cache: { maxAge: 60, staleWhileRevalidate: 120 },
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
providersRouter.openapi(activeLeasesGraphDataRoute, async function routeProviderActiveLeasesGraphData(c) {
  const providerAddress = c.req.valid("param").providerAddress;
  const graphData = await container.resolve(ProviderController).getProviderActiveLeasesGraphData(providerAddress);

  return c.json(graphData);
});
