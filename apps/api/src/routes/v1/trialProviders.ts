import { OpenAPIHono, z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { createRoute } from "@src/core/services/create-route/create-route";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProviderController } from "@src/provider/controllers/provider/provider.controller";

const route = createRoute({
  method: "get",
  path: "/trial-providers",
  tags: ["Trial", "Providers"],
  security: SECURITY_NONE,
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
  const response = await container.resolve(ProviderController).getTrialProviders();
  return c.json(response, 200);
});
