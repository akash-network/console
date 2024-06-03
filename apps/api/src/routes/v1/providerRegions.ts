import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { getProviderRegions } from "@src/services/db/providerDataService";

const route = createRoute({
  method: "get",
  path: "/provider-regions",
  summary: "Get a list of provider regions",
  tags: ["Providers"],
  responses: {
    200: {
      description: "Return a list of provider regions",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              providers: z.array(z.string()),
              key: z.string(),
              description: z.string(),
              value: z.string().optional() // TODO: Keep?
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const response = await cacheResponse(60 * 5, cacheKeys.getProviderRegions, getProviderRegions);
  return c.json(response);
});
