import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { ProviderController } from "@src/deployment/controllers/provider/provider.controller";
import { container } from "tsyringe";

const route = createRoute({
  method: "get",
  path: "/trial-providers",
  tags: ["Trial", "Providers"],
  summary: "Get a list of trial providers.",
  responses: {
    200: {
      description: "List of trial providers",
      content: {
        "application/json": {
          schema: z.array(z.string())
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const response = await container.resolve(ProviderController).findTrialProviders();
  return c.json(response, 200);
});