import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { DeploymentFundingConfigController } from "@src/deployment/controllers/deployment-funding-config/deployment-funding-config.controller";
import { DeploymentFundingConfigResponseSchema } from "@src/deployment/http-schemas/deployment-funding-config.schema";

const route = createRoute({
  method: "get",
  path: "/v1/deployment-funding-config",
  summary: "Get deployment funding config",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getDeploymentFundingConfig",
  tags: ["Deployments"],
  security: SECURITY_NONE,
  cache: { maxAge: 300, staleWhileRevalidate: 600 },
  request: {},
  responses: {
    200: {
      description: "Returns the platform constants automatic deployment funding runs on",
      content: {
        "application/json": {
          schema: DeploymentFundingConfigResponseSchema
        }
      }
    }
  }
});

export const deploymentFundingConfigRouter = new OpenApiHonoHandler();

deploymentFundingConfigRouter.openapi(route, async function routeGetDeploymentFundingConfig(c) {
  return c.json(container.resolve(DeploymentFundingConfigController).getConfig(), 200);
});
