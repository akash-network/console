import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProviderDeploymentsController } from "@src/provider/controllers/provider-deployments/provider-deployments.controller";
import {
  ProviderDeploymentsParamsSchema,
  ProviderDeploymentsQuerySchema,
  ProviderDeploymentsResponseSchema
} from "@src/provider/http-schemas/provider-deployments.schema";

const route = createRoute({
  method: "get",
  path: "/v1/providers/{provider}/deployments/{skip}/{limit}",
  summary: "Get a list of deployments for a provider.",
  tags: ["Providers", "Deployments"],
  security: SECURITY_NONE,
  request: {
    params: ProviderDeploymentsParamsSchema,
    query: ProviderDeploymentsQuerySchema
  },
  responses: {
    200: {
      description: "Returns deployment list",
      content: {
        "application/json": {
          schema: ProviderDeploymentsResponseSchema
        }
      }
    },
    400: {
      description: "Invalid status filter"
    }
  }
});

export const providerDeploymentsRouter = new OpenApiHonoHandler();

providerDeploymentsRouter.openapi(route, async function routeProviderDeployments(c) {
  const { provider, skip, limit } = c.req.valid("param");
  const { status } = c.req.valid("query");

  const response = await container.resolve(ProviderDeploymentsController).getProviderDeployments(provider, skip, limit, status);
  return c.json(response);
});
